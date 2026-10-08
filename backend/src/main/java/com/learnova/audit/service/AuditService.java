package com.learnova.audit.service;

import com.learnova.audit.entity.AuditRecord;
import com.learnova.audit.enums.AuditAction;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.Assert;

@Service
public class AuditService {

    private final EntityManager entityManager;
    private final Clock clock;

    public AuditService(EntityManager entityManager, Clock clock) {
        this.entityManager = entityManager;
        this.clock = clock;
    }

    // Actor lấy từ principal đã xác thực; metadata chỉ chứa các trường an toàn do use case chọn.
    @Transactional(propagation = Propagation.MANDATORY)
    public UUID record(
        String actorUserId,
        AuditAction action,
        String targetType,
        String targetId,
        Map<String, String> metadata
    ) {
        Assert.notNull(action, "action is required");
        Assert.notNull(metadata, "metadata is required");
        var id = UUID.randomUUID();
        entityManager.persist(
            new AuditRecord(
                id,
                actorUserId,
                action,
                targetType,
                targetId,
                metadata,
                Instant.now(clock)
            )
        );
        // Phát hiện lỗi ghi audit trước khi use case kết thúc; cùng transaction với nghiệp vụ.
        entityManager.flush();
        return id;
    }
}
