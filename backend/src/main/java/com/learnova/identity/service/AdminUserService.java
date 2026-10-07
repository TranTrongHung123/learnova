package com.learnova.identity.service;

import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditService;
import com.learnova.identity.dto.AdminUserDtos.*;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.repository.AdminUserQueries;
import com.learnova.identity.repository.UserRepository;
import com.learnova.identity.security.RefreshSessions;
import com.learnova.shared.api.*;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminUserService {
    private static final Set<String> BUSINESS_ROLES = Set.of("PARTICIPANT", "CREATOR");
    private final IdentityService identity;
    private final UserRepository users;
    private final AdminUserQueries queries;
    private final RefreshSessions sessions;
    private final AuditService audit;
    private final JdbcClient jdbc;

    public AdminUserService(IdentityService identity, UserRepository users, AdminUserQueries queries,
            RefreshSessions sessions, AuditService audit, JdbcClient jdbc) {
        this.identity = identity; this.users = users; this.queries = queries;
        this.sessions = sessions; this.audit = audit; this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public PageResponse<Detail> list(UUID actor, String search, String role, String status, PageQuery page) {
        identity.requireAdmin(actor);
        if (search != null && search.length() > 254) throw invalid("search");
        if (role != null && !Set.of("PARTICIPANT", "CREATOR", "ADMIN").contains(role)) throw invalid("role");
        if (status != null && !Set.of("ACTIVE", "LOCKED", "DISABLED").contains(status)) throw invalid("status");
        return queries.list(search, role, status, page);
    }

    @Transactional(readOnly = true)
    public Detail detail(UUID actor, UUID id) {
        identity.requireAdmin(actor);
        return Detail.from(users.findById(id).orElseThrow(AdminUserService::notFound));
    }

    @Transactional
    public Detail status(UUID actor, UUID id, boolean lock) {
        authorizeMutation(actor);
        if (lock && actor.equals(id)) throw new AuthFailure(409, "SELF_LOCK_FORBIDDEN");
        var user = users.lockById(id).orElseThrow(AdminUserService::notFound);
        String next = lock ? "LOCKED" : "ACTIVE", previous = user.getStatus();
        if (previous.equals("DISABLED")) throw new AuthFailure(409, "USER_STATE_CONFLICT");
        if (previous.equals(next)) return Detail.from(user);
        // Redis không rollback cùng PostgreSQL. Lỗi revoke ngăn commit; rollback DB có thể buộc login lại.
        sessions.revokeAll(id);
        user.setStatus(next);
        audit.record(actor.toString(), lock ? AuditAction.ACCOUNT_LOCKED : AuditAction.ACCOUNT_UNLOCKED,
                "User", id.toString(), Map.of("oldStatus", previous, "newStatus", next));
        return Detail.from(user);
    }

    @Transactional
    public Detail roles(UUID actor, UUID id, RolesRequest request) {
        authorizeMutation(actor);
        var requested = request.roles();
        if (requested == null || requested.size() > 2 || requested.stream().anyMatch(r -> r == null || !BUSINESS_ROLES.contains(r))
                || Set.copyOf(requested).size() != requested.size()) throw invalid("roles");
        var user = users.lockById(id).orElseThrow(AdminUserService::notFound);
        if (!user.isOnboardingCompleted()) throw new AuthFailure(409, "USER_ONBOARDING_PENDING");
        var next = new java.util.HashSet<>(requested);
        if (user.getRoles().contains("ADMIN")) next.add("ADMIN");
        if (next.isEmpty()) throw invalid("roles");
        if (next.equals(user.getRoles())) return Detail.from(user);
        String previous = String.join(",", user.getRoles().stream().sorted().toList());
        user.getRoles().clear(); user.getRoles().addAll(next);
        audit.record(actor.toString(), AuditAction.ROLE_CHANGED, "User", id.toString(),
                Map.of("oldRoles", previous, "newRoles", String.join(",", next.stream().sorted().toList())));
        return Detail.from(user);
    }

    private void authorizeMutation(UUID actor) {
        // Tuần tự hóa mutation quản trị để hai Admin không đồng thời khóa lẫn nhau.
        jdbc.sql("select pg_advisory_xact_lock(190019)").query(rs -> { rs.next(); return true; });
        users.lockById(actor).orElseThrow(() -> new AuthFailure(401, "AUTHENTICATION_REQUIRED"));
        identity.requireAdmin(actor);
    }

    private static AuthFailure invalid(String field) { return new AuthFailure(400, "VALIDATION_FAILED", field); }
    private static AuthFailure notFound() { return new AuthFailure(404, "USER_NOT_FOUND"); }
}
