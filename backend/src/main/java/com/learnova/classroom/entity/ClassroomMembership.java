package com.learnova.classroom.entity;

import com.learnova.classroom.enums.MembershipStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;

@Entity
@Table(name = "classroom_memberships")
@Getter
public class ClassroomMembership {
    @Id private UUID id;
    @Column(nullable = false) private UUID classroomId;
    @Column(nullable = false) private UUID userId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private MembershipStatus status;
    @Column(nullable = false) private Instant joinedAt;
    @Column(nullable = false) private Instant updatedAt;

    protected ClassroomMembership() {}
    public ClassroomMembership(UUID classroomId, UUID userId, Instant now) {
        id = UUID.randomUUID();
        this.classroomId = classroomId;
        this.userId = userId;
        joinedAt = now;
        changeStatus(MembershipStatus.ACTIVE, now);
    }
    public void changeStatus(MembershipStatus status, Instant now) {
        this.status = status;
        updatedAt = now;
    }
}
