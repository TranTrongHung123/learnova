package com.learnova.identity.service;

import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditService;
import com.learnova.identity.entity.AuthIdentity;
import com.learnova.identity.entity.User;
import com.learnova.identity.repository.AuthIdentityRepository;
import com.learnova.identity.repository.UserRepository;
import java.time.Clock;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminBootstrapService {

    private final UserRepository users;
    private final AuthIdentityRepository identities;
    private final PasswordEncoder passwords;
    private final AuditService audit;
    private final JdbcClient jdbc;
    private final Clock clock;

    public AdminBootstrapService(
        UserRepository users,
        AuthIdentityRepository identities,
        PasswordEncoder passwords,
        AuditService audit,
        JdbcClient jdbc,
        Clock clock
    ) {
        this.users = users;
        this.identities = identities;
        this.passwords = passwords;
        this.audit = audit;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public void bootstrap(String email, String password, String displayName) {
        // Thông báo lỗi cố định, tuyệt đối không đưa giá trị cấu hình bí mật vào log startup.
        if (email == null || password == null || displayName == null) throw invalid();
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        int length = password.codePointCount(0, password.length());
        if (
            normalized.length() > 254 ||
            !normalized.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") ||
            length < 12 ||
            length > 128 ||
            password.isBlank() ||
            displayName.isBlank() ||
            displayName.strip().codePointCount(0, displayName.strip().length()) > 100
        ) throw invalid();
        jdbc.sql("select pg_advisory_xact_lock(190019)").query(rs -> {
            rs.next();
            return true;
        });
        var existing = users.findByEmail(normalized);
        if (existing.isPresent()) {
            // Chạy lại không đổi password, không mở khóa và không cấp thêm role.
            if (existing.get().getRoles().contains("ADMIN")) return;
            throw new IllegalStateException(
                "Admin bootstrap refuses an existing non-admin account."
            );
        }
        if (
            jdbc
                .sql("select exists(select 1 from user_roles where role='ADMIN')")
                .query(Boolean.class)
                .single()
        ) throw new IllegalStateException(
            "Admin bootstrap is only available before the first administrator exists."
        );
        var user = users.save(
            new User(normalized, displayName.strip(), Set.of("ADMIN"), clock.instant())
        );
        identities.save(new AuthIdentity(user, passwords.encode(password)));
        audit.record(
            null,
            AuditAction.ADMIN_BOOTSTRAPPED,
            "User",
            user.getId().toString(),
            Map.of("newRoles", "ADMIN")
        );
    }

    private static IllegalStateException invalid() {
        return new IllegalStateException("Invalid admin bootstrap configuration.");
    }
}
