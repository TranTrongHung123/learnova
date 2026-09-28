package com.learnova.identity;

import java.time.Clock;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class IdentityService {
    private final UserRepository users;
    private final AuthIdentityRepository identities;
    private final PasswordEncoder passwords;
    private final Clock clock;
    private final String dummyHash;

    IdentityService(UserRepository users, AuthIdentityRepository identities, PasswordEncoder passwords, Clock clock) {
        this.users = users;
        this.identities = identities;
        this.passwords = passwords;
        this.clock = clock;
        dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public AuthDtos.UserSummary register(AuthDtos.RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (!Set.of("PARTICIPANT", "CREATOR").containsAll(request.roles())
                || Set.copyOf(request.roles()).size() != request.roles().size())
            throw new AuthFailure(400, "VALIDATION_FAILED", "roles");
        int length = request.password().codePointCount(0, request.password().length());
        if (length < 12 || length > 128)
            throw new AuthFailure(400, "VALIDATION_FAILED", "password");
        if (users.findByEmail(email).isPresent()) throw new AuthFailure(409, "EMAIL_ALREADY_EXISTS");
        var user = users.save(new User(email, request.displayName().strip(), Set.copyOf(request.roles()), clock.instant()));
        identities.save(new AuthIdentity(user, passwords.encode(request.password())));
        return AuthDtos.UserSummary.from(user);
    }

    @Transactional(readOnly = true)
    public AuthDtos.UserSummary authenticate(AuthDtos.LoginRequest request) {
        String email = normalizeEmail(request.email());
        var identity = identities.findByProviderAndProviderSubject("LOCAL", email);
        boolean matches = passwords.matches(request.password(), identity.map(value -> value.passwordHash).orElse(dummyHash));
        if (!matches || identity.isEmpty()) throw new AuthFailure(401, "INVALID_CREDENTIALS");
        return activeUser(identity.get().userId);
    }

    @Transactional(readOnly = true)
    public AuthDtos.UserSummary activeUser(UUID id) {
        var user = users.findById(id).orElseThrow(() -> new AuthFailure(401, "AUTHENTICATION_REQUIRED"));
        if (!user.status.equals("ACTIVE")) throw new AuthFailure(403, "ACCOUNT_" + user.status);
        if (!user.onboardingCompleted) throw new AuthFailure(403, "ONBOARDING_REQUIRED");
        return AuthDtos.UserSummary.from(user);
    }

    private String normalizeEmail(String value) {
        String email = value.strip().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))
            throw new AuthFailure(400, "VALIDATION_FAILED", "email");
        return email;
    }
}
