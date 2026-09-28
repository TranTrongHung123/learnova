package com.learnova.identity.service;

import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.entity.AuthIdentity;
import com.learnova.identity.entity.User;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.repository.AuthIdentityRepository;
import com.learnova.identity.repository.UserRepository;
import com.learnova.identity.security.google.GoogleFlowStore;
import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditService;
import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class GoogleAccounts {
    private final UserRepository users;
    private final AuthIdentityRepository identities;
    private final IdentityService local;
    private final AuditService audit;
    private final Clock clock;
    private final TransactionTemplate transaction;

    GoogleAccounts(UserRepository users, AuthIdentityRepository identities, IdentityService local,
            AuditService audit, Clock clock, PlatformTransactionManager manager) {
        this.users = users; this.identities = identities; this.local = local;
        this.audit = audit; this.clock = clock; this.transaction = new TransactionTemplate(manager);
    }

    public GoogleFlowStore.Pending recognize(String subject, String email, String name) {
        if (subject == null || subject.isBlank() || subject.length() > 254 || email == null)
            throw new AuthFailure(401, "GOOGLE_IDENTITY_INVALID");
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        if (normalized.length() > 254 || !normalized.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))
            throw new AuthFailure(401, "GOOGLE_IDENTITY_INVALID");
        // Retry ở transaction mới: callback đồng thời có thể vừa tạo cùng email hoặc subject.
        try { return transaction.execute(status -> recognizeInTransaction(subject, normalized, name)); }
        catch (DataIntegrityViolationException ex) {
            return transaction.execute(status -> recognizeInTransaction(subject, normalized, name));
        }
    }

    private GoogleFlowStore.Pending recognizeInTransaction(String subject, String email, String name) {
        var linked = identities.findByProviderAndProviderSubject("GOOGLE", subject);
        if (linked.isPresent()) {
            var user = active(linked.get().getUserId());
            return new GoogleFlowStore.Pending(user.isOnboardingCompleted() ? "AUTHENTICATED" : "ONBOARDING",
                    user.getId(), subject, user.getEmail());
        }
        var existing = users.findByEmail(email);
        if (existing.isPresent()) {
            var user = active(existing.get().getId());
            if (identities.findByProviderAndProviderSubject("LOCAL", email).isEmpty())
                throw new AuthFailure(409, "GOOGLE_IDENTITY_CONFLICT");
            return new GoogleFlowStore.Pending("LINK_REQUIRED", user.getId(), subject, email);
        }
        String displayName = name == null || name.isBlank() ? email : name.strip();
        displayName = displayName.substring(0, Math.min(100, displayName.length()));
        var user = new User(email, displayName, Set.of(), clock.instant());
        user.setOnboardingCompleted(false);
        users.save(user);
        identities.saveAndFlush(AuthIdentity.google(user, subject));
        return new GoogleFlowStore.Pending("ONBOARDING", user.getId(), subject, email);
    }

    public void verify(GoogleFlowStore.Pending pending, String password) {
        if (!pending.state().equals("LINK_REQUIRED")) throw new AuthFailure(409, "GOOGLE_FLOW_CHANGED");
        var user = local.authenticate(new AuthDtos.LoginRequest(pending.email(), password));
        if (!user.id().equals(pending.userId())) throw new AuthFailure(409, "GOOGLE_IDENTITY_CONFLICT");
    }

    public static void validateRoles(List<String> roles) {
        if (roles == null || roles.isEmpty() || roles.size() > 2 || roles.stream().anyMatch(role ->
                role == null || !Set.of("PARTICIPANT", "CREATOR").contains(role))
                || Set.copyOf(roles).size() != roles.size())
            throw new AuthFailure(400, "VALIDATION_FAILED", "roles");
    }

    public UUID onboard(GoogleFlowStore.Pending pending, List<String> roles) {
        validateRoles(roles);
        return transaction.execute(status -> {
            var user = active(pending.userId());
            var identity = identities.findByProviderAndProviderSubject("GOOGLE", pending.subject())
                    .orElseThrow(() -> new AuthFailure(409, "GOOGLE_IDENTITY_CONFLICT"));
            if (!identity.getUserId().equals(user.getId())) throw new AuthFailure(409, "GOOGLE_IDENTITY_CONFLICT");
            if (!user.isOnboardingCompleted()) {
                user.getRoles().addAll(roles);
                user.setOnboardingCompleted(true);
                audit.record(user.getId().toString(), AuditAction.ONBOARDING_COMPLETED, "User", user.getId().toString(), Map.of());
            }
            return user.getId();
        });
    }

    public UUID link(GoogleFlowStore.Pending pending) {
        try {
            return transaction.execute(status -> {
                var user = active(pending.userId());
                var linked = identities.findByProviderAndProviderSubject("GOOGLE", pending.subject());
                if (linked.isPresent()) {
                    if (!linked.get().getUserId().equals(user.getId())) throw new AuthFailure(409, "GOOGLE_IDENTITY_CONFLICT");
                    return user.getId();
                }
                identities.saveAndFlush(AuthIdentity.google(user, pending.subject()));
                audit.record(user.getId().toString(), AuditAction.GOOGLE_ACCOUNT_LINKED, "User", user.getId().toString(), Map.of());
                return user.getId();
            });
        } catch (DataIntegrityViolationException ex) { throw new AuthFailure(409, "GOOGLE_IDENTITY_CONFLICT"); }
    }

    private User active(UUID id) {
        var user = users.lockById(id).orElseThrow(() -> new AuthFailure(401, "AUTHENTICATION_REQUIRED"));
        if (!user.getStatus().equals("ACTIVE")) throw new AuthFailure(403, "ACCOUNT_" + user.getStatus());
        return user;
    }
}
