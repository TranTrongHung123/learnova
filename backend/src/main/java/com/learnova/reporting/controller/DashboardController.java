package com.learnova.reporting.controller;

import com.learnova.reporting.dto.DashboardDtos.*;
import com.learnova.reporting.service.DashboardService;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/participant/dashboard")
    ResponseEntity<Participant> participant(@AuthenticationPrincipal Jwt jwt) {
        return response(service.participant(UUID.fromString(jwt.getSubject())));
    }

    @GetMapping("/creator/dashboard")
    ResponseEntity<Creator> creator(@AuthenticationPrincipal Jwt jwt) {
        return response(service.creator(UUID.fromString(jwt.getSubject())));
    }

    @GetMapping("/admin/dashboard")
    ResponseEntity<Admin> admin(@AuthenticationPrincipal Jwt jwt) {
        return response(service.admin(UUID.fromString(jwt.getSubject())));
    }

    private static <T> ResponseEntity<T> response(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
