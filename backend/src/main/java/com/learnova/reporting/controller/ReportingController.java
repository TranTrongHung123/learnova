package com.learnova.reporting.controller;

import com.learnova.reporting.dto.ReportingDtos.Analytics;
import com.learnova.reporting.service.ReportingService;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/exam-sessions/{id}")
public class ReportingController {
    private final ReportingService service;
    public ReportingController(ReportingService service) { this.service=service; }
    @GetMapping("/analytics")
    ResponseEntity<Analytics> analytics(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.analytics(UUID.fromString(jwt.getSubject()),id));
    }
    @GetMapping("/export")
    ResponseEntity<byte[]> export(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"session-"+id+".xlsx\"")
                .body(service.export(UUID.fromString(jwt.getSubject()),id));
    }
}
