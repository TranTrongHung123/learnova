package com.learnova.identity.service;

import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.entity.AuthIdentity;
import com.learnova.identity.entity.User;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.repository.AuthIdentityRepository;
import com.learnova.identity.repository.UserRepository;
import com.learnova.identity.security.RefreshSessions;
import java.time.Clock;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityService {

    private final UserRepository users;
    private final AuthIdentityRepository identities;
    private final PasswordEncoder passwords;
    private final Clock clock;
    private final String dummyHash;
    private final RefreshSessions sessions;

    IdentityService(
        UserRepository users,
        AuthIdentityRepository identities,
        PasswordEncoder passwords,
        Clock clock,
        RefreshSessions sessions
    ) {
        this.users = users;
        this.identities = identities;
        this.passwords = passwords;
        this.clock = clock;
        this.sessions = sessions;
        dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    public record Login(AuthDtos.UserSummary user, RefreshSessions.Issued issued) {
        @Override
        public String toString() {
            return "Login[redacted]";
        }
    }

    @Transactional
    public Login googleLogin(UUID id, String previous) {
        users.lockById(id).orElseThrow(() -> new AuthFailure(401, "AUTHENTICATION_REQUIRED"));
        var user = activeUser(id);
        if (previous != null) {
            try {
                sessions.revoke(sessions.lookup(previous));
            } catch (AuthFailure ignored) {
                /* Cookie cũ không ngăn phiên đăng nhập mới. */
            }
        }
        return new Login(user, sessions.create(id));
    }

    @Transactional
    public Login refresh(String token) {
        var session = sessions.lookup(token);
        // Cùng khóa với quản trị User: không cấp session sau khi tài khoản đã bị khóa.
        users
            .lockById(session.userId())
            .orElseThrow(() -> new AuthFailure(401, "AUTHENTICATION_REQUIRED"));
        AuthDtos.UserSummary user;
        try {
            user = activeUser(session.userId());
        } catch (AuthFailure failure) {
            sessions.revoke(session);
            throw failure;
        }
        return new Login(user, sessions.rotate(token, session));
    }

    @Transactional(readOnly = true)
    public void requireAdmin(UUID id) {
        if (!activeUser(id).roles().contains("ADMIN")) throw new AuthFailure(403, "ACCESS_DENIED");
    }

    @Transactional
    public Login login(AuthDtos.LoginRequest request, String previous) {
        // Giữ khóa đến sau cấp session để mật khẩu cũ không vượt qua một lần đổi mật khẩu đồng thời.
        users.lockByEmail(normalizeEmail(request.email()));
        var user = authenticate(request);
        if (previous != null) {
            try {
                sessions.revoke(sessions.lookup(previous));
            } catch (AuthFailure ignored) {
                /* Cookie cũ không hợp lệ không ngăn đăng nhập mới. */
            }
        }
        return new Login(user, sessions.create(user.id()));
    }

    @Transactional
    public AuthDtos.UserSummary register(AuthDtos.RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (
            !Set.of("PARTICIPANT", "CREATOR").containsAll(request.roles()) ||
            Set.copyOf(request.roles()).size() != request.roles().size()
        ) throw new AuthFailure(400, "VALIDATION_FAILED", "roles");
        int length = request.password().codePointCount(0, request.password().length());
        if (length < 12 || length > 128) throw new AuthFailure(
            400,
            "VALIDATION_FAILED",
            "password"
        );
        if (users.findByEmail(email).isPresent()) throw new AuthFailure(
            409,
            "EMAIL_ALREADY_EXISTS"
        );
        var user = users.save(
            new User(
                email,
                request.displayName().strip(),
                Set.copyOf(request.roles()),
                clock.instant()
            )
        );
        identities.save(new AuthIdentity(user, passwords.encode(request.password())));
        return AuthDtos.UserSummary.from(user);
    }

    @Transactional(readOnly = true)
    public AuthDtos.UserSummary authenticate(AuthDtos.LoginRequest request) {
        String email = normalizeEmail(request.email());
        var identity = identities.findByProviderAndProviderSubject("LOCAL", email);
        boolean matches = passwords.matches(
            request.password(),
            identity.map(value -> value.getPasswordHash()).orElse(dummyHash)
        );
        if (!matches || identity.isEmpty()) throw new AuthFailure(401, "INVALID_CREDENTIALS");
        return activeUser(identity.get().getUserId());
    }

    @Transactional(readOnly = true)
    public AuthDtos.UserSummary activeUser(UUID id) {
        var user = users
            .findById(id)
            .orElseThrow(() -> new AuthFailure(401, "AUTHENTICATION_REQUIRED"));
        if (!user.getStatus().equals("ACTIVE")) throw new AuthFailure(
            403,
            "ACCOUNT_" + user.getStatus()
        );
        if (!user.isOnboardingCompleted()) throw new AuthFailure(403, "ONBOARDING_REQUIRED");
        return AuthDtos.UserSummary.from(user);
    }

    private String normalizeEmail(String value) {
        String email = value.strip().toLowerCase(Locale.ROOT);
        if (
            email.length() > 254 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")
        ) throw new AuthFailure(400, "VALIDATION_FAILED", "email");
        return email;
    }
}
