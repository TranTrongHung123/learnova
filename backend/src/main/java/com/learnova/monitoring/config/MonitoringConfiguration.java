package com.learnova.monitoring.config;

import com.learnova.monitoring.controller.MonitoringSocket;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.*;

@Configuration(proxyBeanMethods=false)
@EnableWebSocket
public class MonitoringConfiguration implements WebSocketConfigurer {
    private final MonitoringSocket socket;
    private final String[] origins;
    public MonitoringConfiguration(MonitoringSocket socket,@Value("${learnova.auth.allowed-origins:http://localhost:3000}") String origins) {
        this.socket=socket; this.origins=Arrays.stream(origins.split(",")).map(String::strip).toArray(String[]::new);
    }
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(socket,"/api/v1/monitoring/ws").setAllowedOrigins(origins);
    }
    @Bean(name="taskScheduler")
    ThreadPoolTaskScheduler businessScheduler() {
        var scheduler=new ThreadPoolTaskScheduler();
        scheduler.setThreadNamePrefix("business-scheduler-");
        return scheduler;
    }
    @Bean(name="monitoringScheduler")
    ThreadPoolTaskScheduler monitoringScheduler() {
        // Client chậm không được trì hoãn scheduler deadline của bài thi.
        var scheduler=new ThreadPoolTaskScheduler();
        scheduler.setThreadNamePrefix("monitoring-scheduler-");
        return scheduler;
    }
}
