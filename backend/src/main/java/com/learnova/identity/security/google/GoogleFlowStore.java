package com.learnova.identity.security.google;

import com.learnova.identity.exception.AuthFailure;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class GoogleFlowStore {

    public static final String COOKIE = "learnova_google_flow";
    static final Duration TTL = Duration.ofMinutes(10);
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final boolean secure;
    private static final SecureRandom RANDOM = new SecureRandom();

    GoogleFlowStore(
        StringRedisTemplate redis,
        ObjectMapper mapper,
        @Value("${learnova.auth.cookie-secure:true}") boolean secure
    ) {
        this.redis = redis;
        this.mapper = mapper;
        this.secure = secure;
    }

    public record Pending(String state, UUID userId, String subject, String email) {
        @Override
        public String toString() {
            return "Pending[redacted]";
        }
    }

    String browserToken(HttpServletRequest request) {
        if (request.getCookies() != null) for (var cookie : request.getCookies())
            if (
                COOKIE.equals(cookie.getName()) && cookie.getValue().matches("[A-Za-z0-9_-]{43}")
            ) return cookie.getValue();
        return null;
    }

    String replace(HttpServletRequest request, HttpServletResponse response) {
        cancel(request, response);
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        cookie(response, token, TTL);
        return token;
    }

    public void pending(HttpServletRequest request, HttpServletResponse response, Pending value) {
        put("pending", replace(request, response), mapper.writeValueAsString(value));
    }

    public Pending read(HttpServletRequest request) {
        String raw = get("pending", browserToken(request));
        if (raw == null) throw new AuthFailure(401, "GOOGLE_FLOW_EXPIRED");
        return mapper.readValue(raw, Pending.class);
    }

    public void beginPasswordAttempt(HttpServletRequest request) {
        read(request);
        Long count = redis.execute(
            new DefaultRedisScript<>(
                """
                local n = redis.call('INCR', KEYS[1])
                if n == 1 then redis.call('EXPIRE', KEYS[1], 600) end
                return n
                """,
                Long.class
            ),
            List.of(key("attempts", browserToken(request)))
        );
        if (count == null || count > 5) throw new AuthFailure(429, "GOOGLE_LINK_ATTEMPTS_EXCEEDED");
    }

    public void verified(HttpServletRequest request, Pending previous) {
        var next = new Pending(
            "LINK_CONFIRMATION",
            previous.userId(),
            previous.subject(),
            previous.email()
        );
        Long changed = redis.execute(
            new DefaultRedisScript<>(
                """
                if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
                redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
                return 1
                """,
                Long.class
            ),
            List.of(key("pending", browserToken(request))),
            mapper.writeValueAsString(previous),
            mapper.writeValueAsString(next)
        );
        if (!Long.valueOf(1).equals(changed)) throw new AuthFailure(409, "GOOGLE_FLOW_CHANGED");
    }

    public Pending consume(HttpServletRequest request, String expectedState) {
        var pending = read(request);
        if (!pending.state().equals(expectedState)) throw new AuthFailure(
            409,
            "GOOGLE_FLOW_CHANGED"
        );
        Long consumed = redis.execute(
            new DefaultRedisScript<>(
                """
                if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
                redis.call('DEL', KEYS[1])
                return 1
                """,
                Long.class
            ),
            List.of(key("pending", browserToken(request))),
            mapper.writeValueAsString(pending)
        );
        if (!Long.valueOf(1).equals(consumed)) throw new AuthFailure(409, "GOOGLE_FLOW_CHANGED");
        return pending;
    }

    public void cancel(HttpServletRequest request, HttpServletResponse response) {
        String token = browserToken(request);
        if (token != null) redis.delete(
            List.of(key("pending", token), key("oauth", token), key("attempts", token))
        );
        cookie(response, "", Duration.ZERO);
    }

    public void put(String kind, String token, String value) {
        redis.opsForValue().set(key(kind, token), value, TTL);
    }

    public String get(String kind, String token) {
        return token == null ? null : redis.opsForValue().get(key(kind, token));
    }

    String take(String kind, String token) {
        return token == null ? null : redis.opsForValue().getAndDelete(key(kind, token));
    }

    private String key(String kind, String token) {
        if (token == null) throw new AuthFailure(401, "GOOGLE_FLOW_EXPIRED");
        try {
            return (
                "google:" +
                kind +
                ":" +
                HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(
                        token.getBytes(StandardCharsets.UTF_8)
                    )
                )
            );
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private void cookie(HttpServletResponse response, String value, Duration age) {
        response.addHeader(
            HttpHeaders.SET_COOKIE,
            ResponseCookie.from(COOKIE, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/api/v1/auth/google")
                .maxAge(age)
                .build()
                .toString()
        );
    }
}
