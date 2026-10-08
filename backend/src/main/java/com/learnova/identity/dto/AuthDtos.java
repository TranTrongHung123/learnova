package com.learnova.identity.dto;

import com.learnova.identity.entity.User;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
        @NotBlank @Size(max = 254) String email,
        @NotNull @Size(max = 256) String password,
        @NotBlank @Size(max = 100) String displayName,
        @NotEmpty @Size(max = 2) List<@NotNull String> roles
    ) {
        @Override
        public String toString() {
            return "RegisterRequest[redacted]";
        }
    }

    public record LoginRequest(
        @NotBlank @Size(max = 254) String email,
        @NotNull @Size(max = 256) String password
    ) {
        @Override
        public String toString() {
            return "LoginRequest[redacted]";
        }
    }

    public record UserSummary(
        UUID id,
        String email,
        String displayName,
        String avatarUrl,
        String status,
        List<String> roles
    ) {
        public static UserSummary from(User user) {
            return new UserSummary(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getStatus(),
                user.getRoles().stream().sorted().toList()
            );
        }
    }

    public record TokenResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        Instant expiresAt,
        UserSummary user
    ) {
        @Override
        public String toString() {
            return "TokenResponse[redacted]";
        }
    }
}
