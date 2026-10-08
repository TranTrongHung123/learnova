package com.learnova.identity.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.learnova.identity.entity.User;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ProfileDtos {

    private ProfileDtos() {}

    public record Profile(
        UUID id,
        String email,
        String displayName,
        String avatarUrl,
        List<String> roles,
        String status,
        Instant createdAt,
        boolean hasLocalIdentity
    ) {
        public static Profile from(User user, boolean local) {
            return new Profile(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getRoles().stream().sorted().toList(),
                user.getStatus(),
                user.getCreatedAt(),
                local
            );
        }
    }

    public record UpdateProfile(
        @NotNull @Size(max = 200) String displayName,
        @Size(max = 2048) String avatarUrl
    ) {
        // Reject payload mở rộng thay vì âm thầm bỏ qua field chỉ đọc.
        @JsonAnySetter
        public void unknown(String field, Object value) {
            throw new IllegalArgumentException("Unknown profile field");
        }
    }

    public record ChangePassword(
        @NotNull @Size(max = 256) String currentPassword,
        @NotNull @Size(max = 256) String newPassword
    ) {
        @JsonAnySetter
        public void unknown(String field, Object value) {
            throw new IllegalArgumentException("Unknown password field");
        }

        @Override
        public String toString() {
            return "ChangePassword[redacted]";
        }
    }
}
