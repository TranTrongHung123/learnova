package com.learnova.identity.service;

import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditService;
import com.learnova.identity.dto.ProfileDtos;
import com.learnova.identity.entity.User;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.repository.AuthIdentityRepository;
import com.learnova.identity.repository.UserRepository;
import com.learnova.identity.security.RefreshSessions;
import java.net.URI;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {
    private final UserRepository users;
    private final AuthIdentityRepository identities;
    private final PasswordEncoder passwords;
    private final RefreshSessions sessions;
    private final AuditService audit;

    ProfileService(UserRepository users, AuthIdentityRepository identities, PasswordEncoder passwords,
            RefreshSessions sessions, AuditService audit) {
        this.users = users; this.identities = identities; this.passwords = passwords;
        this.sessions = sessions; this.audit = audit;
    }

    @Transactional(readOnly = true)
    public ProfileDtos.Profile get(UUID id) {
        return profile(active(users.findById(id).orElseThrow(ProfileService::unauthenticated)));
    }

    @Transactional
    public ProfileDtos.Profile update(UUID id, ProfileDtos.UpdateProfile input) {
        String name = input.displayName().strip();
        if (name.isBlank() || name.codePointCount(0, name.length()) > 100)
            throw new AuthFailure(400, "VALIDATION_FAILED", "displayName");
        String avatar = avatar(input.avatarUrl());
        var user = active(users.lockById(id).orElseThrow(ProfileService::unauthenticated));
        user.updateProfile(name, avatar);
        return profile(user);
    }

    @Transactional
    public void changePassword(UUID id, String sessionId, ProfileDtos.ChangePassword input) {
        var user = active(users.lockById(id).orElseThrow(ProfileService::unauthenticated));
        var local = identities.findByUserIdAndProvider(id, "LOCAL")
                .orElseThrow(() -> new AuthFailure(403, "LOCAL_IDENTITY_REQUIRED"));
        if (!passwords.matches(input.currentPassword(), local.getPasswordHash()))
            throw new AuthFailure(400, "CURRENT_PASSWORD_INCORRECT", "currentPassword");
        int length = input.newPassword().codePointCount(0, input.newPassword().length());
        if (length < 12 || length > 128) throw new AuthFailure(400, "VALIDATION_FAILED", "newPassword");
        String hash = passwords.encode(input.newPassword());
        // Redis không tham gia DB transaction: lỗi revoke phải ngăn commit credentials mới.
        sessions.revokeOthers(id, sessionId);
        local.changePassword(hash);
        audit.record(user.getId().toString(), AuditAction.PASSWORD_CHANGED, "User", id.toString(), Map.of());
    }

    private ProfileDtos.Profile profile(User user) {
        return ProfileDtos.Profile.from(user, identities.findByUserIdAndProvider(user.getId(), "LOCAL").isPresent());
    }
    private User active(User user) {
        if (!user.getStatus().equals("ACTIVE")) throw new AuthFailure(403, "ACCOUNT_" + user.getStatus());
        if (!user.isOnboardingCompleted()) throw new AuthFailure(403, "ONBOARDING_REQUIRED");
        return user;
    }
    private static AuthFailure unauthenticated() { return new AuthFailure(401, "AUTHENTICATION_REQUIRED"); }
    private String avatar(String input) {
        if (input == null || input.isBlank()) return null;
        String value = input.strip();
        try {
            URI uri = URI.create(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                    || value.length() > 2048 || uri.getPort() > 65535)
                throw new IllegalArgumentException();
            return value;
        } catch (IllegalArgumentException ex) { throw new AuthFailure(400, "VALIDATION_FAILED", "avatarUrl"); }
    }
}
