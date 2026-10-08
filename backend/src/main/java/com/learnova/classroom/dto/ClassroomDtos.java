package com.learnova.classroom.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.learnova.classroom.enums.MembershipStatus;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

public final class ClassroomDtos {

    private ClassroomDtos() {}

    public record WriteClassroom(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 2000) String description
    ) {
        @JsonAnySetter
        public void unknown(String field, Object value) {
            throw new IllegalArgumentException("Unknown classroom field");
        }
    }

    public record AddMember(@NotNull UUID userId) {
        @JsonAnySetter
        public void unknown(String field, Object value) {
            throw new IllegalArgumentException("Unknown membership field");
        }
    }

    public record CodeRequest(@NotBlank @Size(max = 64) String code) {
        @JsonAnySetter
        public void unknown(String field, Object value) {
            throw new IllegalArgumentException("Unknown join field");
        }

        @Override
        public String toString() {
            return "CodeRequest[redacted]";
        }
    }

    public record OwnerSummary(
        UUID id,
        String name,
        String description,
        long activeParticipants,
        String joinCodeStatus,
        Instant updatedAt
    ) {}

    public record OwnerDetail(
        UUID id,
        String name,
        String description,
        long activeParticipants,
        JoinCodeView joinCode,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record JoinCodeView(String status, String code, Instant expiresAt) {
        @Override
        public String toString() {
            return "JoinCodeView[redacted]";
        }
    }

    public record Member(
        UUID id,
        UUID userId,
        String email,
        String displayName,
        MembershipStatus status,
        Instant joinedAt,
        Instant updatedAt
    ) {}

    public record Membership(
        UUID id,
        UUID classroomId,
        UUID userId,
        MembershipStatus status,
        Instant joinedAt,
        Instant updatedAt
    ) {}

    public record ParticipantClassroom(
        UUID id,
        String name,
        String description,
        String creatorName,
        Instant joinedAt
    ) {}

    public record Preview(
        UUID id,
        String name,
        String description,
        String creatorName,
        MembershipStatus membershipStatus
    ) {}
}
