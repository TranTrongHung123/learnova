package com.learnova.identity.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.learnova.identity.entity.User;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AdminUserDtos {

    private AdminUserDtos() {}

    public record RolesRequest(@NotNull @Size(max = 2) List<@NotNull String> roles) {
        @JsonAnySetter
        public void unknown(String field, Object value) {
            throw new IllegalArgumentException("Unknown role field");
        }
    }

    public record Detail(
        UUID id,
        String email,
        String displayName,
        String status,
        List<String> roles,
        Instant createdAt,
        boolean onboardingCompleted
    ) {
        public static Detail from(User user) {
            return new Detail(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getStatus(),
                user.getRoles().stream().sorted().toList(),
                user.getCreatedAt(),
                user.isOnboardingCompleted()
            );
        }
    }
}
