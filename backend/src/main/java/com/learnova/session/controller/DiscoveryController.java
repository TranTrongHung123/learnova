package com.learnova.session.controller;

import com.learnova.session.dto.DiscoveryDtos.*;
import com.learnova.session.service.DiscoveryService;
import com.learnova.shared.api.*;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/participant/exam-sessions")
public class DiscoveryController {
    private final DiscoveryService service;
    public DiscoveryController(DiscoveryService service) { this.service=service; }
    @GetMapping
    PageResponse<Session> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue="AVAILABLE") Tab tab, PageQuery page) {
        return service.list(UUID.fromString(jwt.getSubject()),tab,page);
    }
    @GetMapping("/{id}")
    Session detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.detail(UUID.fromString(jwt.getSubject()),id);
    }
    @GetMapping("/{id}/attempts")
    PageResponse<Attempt> history(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, PageQuery page) {
        return service.history(UUID.fromString(jwt.getSubject()),id,page);
    }
}
