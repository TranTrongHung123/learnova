package com.learnova.admin.controller;

import com.learnova.audit.dto.AuditDtos.Item;
import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditQueryService;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.service.IdentityService;
import com.learnova.shared.api.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/audit-logs")
public class AdminAuditController {
    private final IdentityService identity;
    private final AuditQueryService audit;
    public AdminAuditController(IdentityService identity, AuditQueryService audit) { this.identity = identity; this.audit = audit; }

    @GetMapping
    PageResponse<Item> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String actorUserId,
            @RequestParam(required = false) AuditAction action, @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String targetId, @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to, PageQuery page) {
        identity.requireAdmin(UUID.fromString(jwt.getSubject()));
        validate(actorUserId, 128, "actorUserId"); validate(targetType, 64, "targetType"); validate(targetId, 128, "targetId");
        if (from != null && to != null && !from.isBefore(to)) throw new AuthFailure(400, "VALIDATION_FAILED", "to");
        return audit.list(actorUserId, action, targetType, targetId, from, to, page);
    }
    private void validate(String value, int max, String field) {
        if (value != null && (value.isBlank() || value.length() > max)) throw new AuthFailure(400, "VALIDATION_FAILED", field);
    }
}
