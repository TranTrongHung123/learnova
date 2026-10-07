package com.learnova.identity.controller;

import com.learnova.identity.dto.AdminUserDtos.*;
import com.learnova.identity.service.AdminUserService;
import com.learnova.shared.api.*;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/users")
public class AdminUserController {
    private final AdminUserService service;
    public AdminUserController(AdminUserService service) { this.service = service; }

    @GetMapping
    PageResponse<Detail> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String search,
            @RequestParam(required = false) String role, @RequestParam(required = false) String status, PageQuery page) {
        return service.list(UUID.fromString(jwt.getSubject()), search, role, status, page);
    }
    @GetMapping("/{id}")
    Detail detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.detail(UUID.fromString(jwt.getSubject()), id);
    }
    @PostMapping("/{id}/lock")
    Detail lock(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.status(UUID.fromString(jwt.getSubject()), id, true);
    }
    @PostMapping("/{id}/unlock")
    Detail unlock(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.status(UUID.fromString(jwt.getSubject()), id, false);
    }
    @PutMapping("/{id}/roles")
    Detail roles(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody RolesRequest request) {
        return service.roles(UUID.fromString(jwt.getSubject()), id, request);
    }
}
