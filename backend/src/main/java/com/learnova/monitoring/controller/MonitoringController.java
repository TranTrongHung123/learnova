package com.learnova.monitoring.controller;

import com.learnova.monitoring.dto.MonitoringDtos.Snapshot;
import com.learnova.monitoring.service.MonitoringService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class MonitoringController {

    private final MonitoringService service;

    public MonitoringController(MonitoringService service) {
        this.service = service;
    }

    @GetMapping("/api/v1/exam-sessions/{id}/monitor")
    ResponseEntity<Snapshot> snapshot(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ResponseEntity.ok()
            .header("Cache-Control", "no-store")
            .body(service.snapshot(UUID.fromString(jwt.getSubject()), id));
    }
}
