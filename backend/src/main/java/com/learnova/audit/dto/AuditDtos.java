package com.learnova.audit.dto;

import com.learnova.audit.enums.AuditAction;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class AuditDtos {
    private AuditDtos() {}
    public record Item(UUID id, String actorUserId, AuditAction action, String targetType,
            String targetId, Map<String, String> metadata, Instant occurredAt) {}
}
