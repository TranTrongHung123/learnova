package com.learnova.classroom.entity;

import jakarta.persistence.*;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;

@Entity
@Table(name = "classroom_join_codes")
@Getter
public class ClassroomJoinCode {

    @Id
    private UUID classroomId;

    @Column(nullable = false, unique = true, length = 16)
    private String code;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant revokedAt;

    protected ClassroomJoinCode() {}

    public ClassroomJoinCode(UUID classroomId, String code, Instant now) {
        this.classroomId = classroomId;
        regenerate(code, now);
    }

    public void regenerate(String code, Instant now) {
        this.code = code;
        createdAt = now;
        expiresAt = now.plus(Duration.ofDays(7));
        revokedAt = null;
    }

    public void revoke(Instant now) {
        revokedAt = now;
    }

    public boolean validAt(Instant now) {
        return revokedAt == null && now.isBefore(expiresAt);
    }

    public String statusAt(Instant now) {
        return revokedAt != null ? "REVOKED" : validAt(now) ? "ACTIVE" : "EXPIRED";
    }
}
