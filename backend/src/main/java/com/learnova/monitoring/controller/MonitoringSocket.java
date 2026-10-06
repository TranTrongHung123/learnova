package com.learnova.monitoring.controller;

import com.learnova.identity.exception.AuthFailure;
import com.learnova.monitoring.service.*;
import com.learnova.session.exception.SessionFailure;
import java.io.IOException;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.*;
import tools.jackson.databind.ObjectMapper;

@Component
public class MonitoringSocket extends TextWebSocketHandler {
    private static final CloseStatus UNAUTHORIZED=new CloseStatus(4401,"Authentication required");
    private static final CloseStatus FORBIDDEN=new CloseStatus(4403,"Subscription denied");
    private final Map<String,Connection> connections=new ConcurrentHashMap<>();
    private final MonitoringService service;
    private final JwtDecoder decoder;
    private final ObjectMapper json;
    private final Clock clock;
    private static final class Connection {
        final WebSocketSession socket;
        final Instant opened;
        final MonitoringStream stream=new MonitoringStream();
        UUID actor,session;
        Instant expires;
        Connection(WebSocketSession socket,Instant opened) {
            this.socket=new ConcurrentWebSocketSessionDecorator(socket,5000,1048576); this.opened=opened;
        }
    }
    public MonitoringSocket(MonitoringService service,JwtDecoder decoder,ObjectMapper json,Clock clock) {
        this.service=service; this.decoder=decoder; this.json=json; this.clock=clock;
    }
    @Override public void afterConnectionEstablished(WebSocketSession socket) throws IOException {
        if (socket.getUri()==null || socket.getUri().getRawQuery()!=null) { socket.close(FORBIDDEN); return; }
        socket.setTextMessageSizeLimit(8192);
        connections.put(socket.getId(),new Connection(socket,clock.instant()));
    }
    @Override protected void handleTextMessage(WebSocketSession socket,TextMessage message) {
        var c=connections.get(socket.getId());
        if (c==null) return;
        synchronized(c) {
            if (c.actor!=null) { close(c,CloseStatus.POLICY_VIOLATION); return; }
            try {
                var input=json.readTree(message.getPayload());
                if (input==null || !input.isObject() || input.size()!=3 || !input.path("accessToken").isString()
                        || !"SUBSCRIBE".equals(input.path("type").asText())) { close(c,FORBIDDEN); return; }
                var jwt=decoder.decode(input.path("accessToken").asText());
                if (jwt.getExpiresAt()==null || !clock.instant().isBefore(jwt.getExpiresAt())) { close(c,UNAUTHORIZED); return; }
                UUID actor=UUID.fromString(jwt.getSubject()),session=UUID.fromString(input.path("sessionId").asText());
                var snapshot=service.snapshot(actor,session);
                c.actor=actor; c.session=session; c.expires=jwt.getExpiresAt();
                c.socket.sendMessage(new TextMessage(json.writeValueAsString(c.stream.next(snapshot))));
            } catch (JwtException ex) { close(c,UNAUTHORIZED); }
            catch (SessionFailure | AuthFailure ex) { close(c,FORBIDDEN); }
            catch (IllegalArgumentException | tools.jackson.core.JacksonException ex) { close(c,CloseStatus.BAD_DATA); }
            catch (IOException ex) { close(c,CloseStatus.SERVER_ERROR); }
        }
    }
    // Đọc projection đã commit rồi gửi phần thay đổi; không giữ transaction qua socket.
    // Đối soát định kỳ cũng bắt được thay đổi roster, timeout presence và commit từ instance khác.
    @Scheduled(fixedDelayString="${learnova.monitoring.update-delay-ms:2000}",scheduler="monitoringScheduler")
    public void update() {
        for (var c:connections.values()) synchronized(c) {
            if (c.actor==null) {
                if (!clock.instant().isBefore(c.opened.plusSeconds(10))) close(c,UNAUTHORIZED);
                continue;
            }
            if (!clock.instant().isBefore(c.expires)) { close(c,UNAUTHORIZED); continue; }
            try {
                c.socket.sendMessage(new TextMessage(json.writeValueAsString(c.stream.next(service.snapshot(c.actor,c.session)))));
            } catch (SessionFailure | AuthFailure ex) { close(c,FORBIDDEN); }
            catch (RuntimeException | IOException ex) { close(c,CloseStatus.SERVER_ERROR); }
        }
    }
    @Override public void afterConnectionClosed(WebSocketSession socket,CloseStatus status) { connections.remove(socket.getId()); }
    @Override public void handleTransportError(WebSocketSession socket,Throwable exception) {
        var c=connections.get(socket.getId()); if (c!=null) close(c,CloseStatus.SERVER_ERROR);
    }
    private void close(Connection c,CloseStatus status) {
        connections.remove(c.socket.getId());
        try { c.socket.close(status); } catch (IOException ignored) { /* Transport đã đóng. */ }
    }
}
