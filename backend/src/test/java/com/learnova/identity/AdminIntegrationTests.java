package com.learnova.identity;

import com.learnova.TestcontainersConfiguration;
import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.dto.AdminUserDtos.RolesRequest;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.security.AccessTokens;
import com.learnova.identity.security.RefreshSessions;
import com.learnova.identity.service.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AdminIntegrationTests {
    static final String ADMIN_EMAIL = UUID.randomUUID() + "@example.com";
    static final String PASSWORD = UUID.randomUUID().toString();
    @DynamicPropertySource static void bootstrap(DynamicPropertyRegistry properties) {
        properties.add("learnova.admin.bootstrap.enabled", () -> true);
        properties.add("learnova.admin.bootstrap.email", () -> ADMIN_EMAIL);
        properties.add("learnova.admin.bootstrap.password", () -> PASSWORD);
        properties.add("learnova.admin.bootstrap.display-name", () -> "Operations admin");
    }
    @Autowired IdentityService identity;
    @Autowired AdminUserService adminUsers;
    @Autowired AdminBootstrapService bootstrap;
    @Autowired RefreshSessions sessions;
    @Autowired AccessTokens tokens;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PlatformTransactionManager manager;

    @Test void bootstrapIsAdminOnlyIdempotentAndCannotTakeOverAnAccount() {
        var admin = admin();
        assertThat(admin.roles()).containsExactly("ADMIN");
        assertThat(identity.authenticate(new AuthDtos.LoginRequest(ADMIN_EMAIL, PASSWORD)).id()).isEqualTo(admin.id());
        bootstrap.bootstrap(ADMIN_EMAIL, "Different password 123", "Changed name");
        assertThat(identity.activeUser(admin.id()).displayName()).isEqualTo("Operations admin");
        assertThat(identity.authenticate(new AuthDtos.LoginRequest(ADMIN_EMAIL, PASSWORD)).id()).isEqualTo(admin.id());
        var other = user("PARTICIPANT");
        assertThatThrownBy(() -> bootstrap.bootstrap(other.email(), PASSWORD, "Admin")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> bootstrap.bootstrap(UUID.randomUUID() + "@example.com", PASSWORD, "Admin"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> bootstrap.bootstrap("invalid", "short", "Admin")).isInstanceOf(IllegalStateException.class);
        assertThat(identity.activeUser(other.id()).roles()).containsExactly("PARTICIPANT");
        assertThat(auditCount(admin.id(), "ADMIN_BOOTSTRAPPED")).isEqualTo(1);
    }

    @Test void userListSearchFiltersPaginationAndDetailExposeOnlyAllowedFields() throws Exception {
        var actor = admin(); var target = user("PARTICIPANT", "CREATOR");
        String query = target.email().substring(0, 15).toUpperCase(Locale.ROOT);
        mvc.perform(get("/api/v1/admin/users").with(as(actor)).param("search", query).param("role", "CREATOR").param("status", "ACTIVE").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(target.id().toString())).andExpect(jsonPath("$.totalPages").value(1));
        mvc.perform(get("/api/v1/admin/users").with(as(actor)).param("search", target.email()).param("page", "1").param("size", "1"))
                .andExpect(jsonPath("$.content").isEmpty());
        mvc.perform(get("/api/v1/admin/users").with(as(actor)).param("search", "%_no_wildcards"))
                .andExpect(jsonPath("$.totalElements").value(0));
        var body = mvc.perform(get("/api/v1/admin/users/" + target.id()).with(as(actor)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(body).propertyNames()).containsExactlyInAnyOrder("id", "email", "displayName", "status", "roles", "createdAt", "onboardingCompleted");
        mvc.perform(get("/api/v1/admin/users/" + UUID.randomUUID()).with(as(actor))).andExpect(status().isNotFound());
        for (var entry : Map.of("role", "ROOT", "status", "UNKNOWN", "size", "101", "page", "-1").entrySet())
            mvc.perform(get("/api/v1/admin/users").with(as(actor)).param(entry.getKey(), entry.getValue())).andExpect(status().isBadRequest());
    }

    @Test void everyAdminEndpointRejectsParticipantCreatorAndUnauthenticatedRequests() throws Exception {
        var target = user("PARTICIPANT");
        for (String role : List.of("PARTICIPANT", "CREATOR")) {
            var actor = user(role);
            for (String path : List.of("/api/v1/admin/users", "/api/v1/admin/users/" + target.id(), "/api/v1/admin/audit-logs"))
                mvc.perform(get(path).with(as(actor))).andExpect(status().isForbidden());
            for (String command : List.of("lock", "unlock"))
                mvc.perform(post("/api/v1/admin/users/" + target.id() + "/" + command).with(as(actor))).andExpect(status().isForbidden());
            mvc.perform(put("/api/v1/admin/users/" + target.id() + "/roles").with(as(actor)).contentType("application/json").content("{\"roles\":[\"CREATOR\"]}"))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/v1/admin/users")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/audit-logs")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/questions").with(as(admin()))).andExpect(status().isForbidden());
        // Claim ADMIN cũ không vượt qua quyền hiện tại trong database.
        var ordinary = user("PARTICIPANT");
        var forgedRoles = new AuthDtos.UserSummary(ordinary.id(), ordinary.email(), ordinary.displayName(), null, "ACTIVE", List.of("ADMIN"));
        mvc.perform(get("/api/v1/admin/users").with(as(forgedRoles))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/audit-logs").with(as(forgedRoles))).andExpect(status().isForbidden());
    }

    @Test void lockRevokesEverySessionUnlockRequiresLoginAndStartAttemptChecksCurrentStatus() throws Exception {
        var actor = admin(); var target = user("PARTICIPANT");
        var first = identity.login(new AuthDtos.LoginRequest(target.email(), PASSWORD), null);
        var second = identity.googleLogin(target.id(), null);
        mvc.perform(post("/api/v1/admin/users/" + target.id() + "/lock").with(as(actor)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("LOCKED"));
        assertThatThrownBy(() -> identity.login(new AuthDtos.LoginRequest(target.email(), PASSWORD), null)).isInstanceOf(AuthFailure.class);
        assertThatThrownBy(() -> identity.googleLogin(target.id(), null)).isInstanceOf(AuthFailure.class);
        assertThatThrownBy(() -> identity.refresh(first.issued().token())).isInstanceOf(AuthFailure.class);
        mvc.perform(post("/api/v1/exam-sessions/" + UUID.randomUUID() + "/attempts").with(as(target)))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));
        mvc.perform(post("/api/v1/admin/users/" + target.id() + "/unlock").with(as(actor)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        for (var issued : List.of(first.issued(), second.issued()))
            assertThatThrownBy(() -> identity.refresh(issued.token())).isInstanceOf(AuthFailure.class);
        assertThat(identity.login(new AuthDtos.LoginRequest(target.email(), PASSWORD), null)).isNotNull();
        assertThat(auditCount(target.id(), "ACCOUNT_LOCKED")).isEqualTo(1);
        assertThat(auditCount(target.id(), "ACCOUNT_UNLOCKED")).isEqualTo(1);
        mvc.perform(post("/api/v1/admin/users/" + actor.id() + "/lock").with(as(actor)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SELF_LOCK_FORBIDDEN"));
    }

    @Test void roleReplacementCannotGrantOrRemoveAdminAndAuditsOnlyRealChanges() throws Exception {
        var actor = admin(); var target = user("PARTICIPANT");
        for (String body : List.of("{\"roles\":[\"ADMIN\"]}", "{\"roles\":[]}", "{\"roles\":[\"CREATOR\",\"CREATOR\"]}",
                "{\"roles\":[null]}", "{\"roles\":[\"CREATOR\"],\"status\":\"LOCKED\"}", "{\"roles\":[\"ROOT\"]}"))
            mvc.perform(put("/api/v1/admin/users/" + target.id() + "/roles").with(as(actor)).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        assertThat(identity.activeUser(target.id()).roles()).containsExactly("PARTICIPANT");
        var request = new RolesRequest(List.of("PARTICIPANT", "CREATOR"));
        adminUsers.roles(actor.id(), target.id(), request); adminUsers.roles(actor.id(), target.id(), request);
        assertThat(auditCount(target.id(), "ROLE_CHANGED")).isEqualTo(1);
        assertThat(identity.activeUser(target.id()).roles()).containsExactly("CREATOR", "PARTICIPANT");
        assertThat(adminUsers.roles(actor.id(), actor.id(), new RolesRequest(List.of())).roles()).containsExactly("ADMIN");
        assertThat(auditCount(actor.id(), "ROLE_CHANGED")).isZero();
        jdbc.update("update users set onboarding_completed=false where id=?", target.id());
        mvc.perform(put("/api/v1/admin/users/" + target.id() + "/roles").with(as(actor)).contentType("application/json").content("{\"roles\":[\"CREATOR\"]}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_ONBOARDING_PENDING"));
    }

    @Test void concurrentLockIsIdempotentAndWaitingLoginGoogleAndRefreshCannotEscapeLock() throws Exception {
        var actor = admin(); var target = user("PARTICIPANT");
        var issued = identity.login(new AuthDtos.LoginRequest(target.email(), PASSWORD), null).issued();
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var futures = new ArrayList<Future<Boolean>>();
            new TransactionTemplate(manager).executeWithoutResult(tx -> {
                jdbc.queryForObject("select id from users where id=? for update", UUID.class, target.id());
                for (Callable<?> operation : List.<Callable<?>>of(
                        () -> identity.login(new AuthDtos.LoginRequest(target.email(), PASSWORD), null),
                        () -> identity.googleLogin(target.id(), null), () -> identity.refresh(issued.token())))
                    futures.add(pool.submit(() -> { try { operation.call(); return false; } catch (AuthFailure ex) { return true; } }));
                adminUsers.status(actor.id(), target.id(), true);
            });
            for (var future : futures) assertThat(future.get(20, TimeUnit.SECONDS)).isTrue();
            var a = pool.submit(() -> adminUsers.status(actor.id(), target.id(), true));
            var b = pool.submit(() -> adminUsers.status(actor.id(), target.id(), true));
            assertThat(a.get(20, TimeUnit.SECONDS).status()).isEqualTo("LOCKED");
            assertThat(b.get(20, TimeUnit.SECONDS).status()).isEqualTo("LOCKED");
        }
        assertThat(auditCount(target.id(), "ACCOUNT_LOCKED")).isEqualTo(1);
        adminUsers.status(actor.id(), target.id(), false);
        assertThatThrownBy(() -> identity.refresh(issued.token())).isInstanceOf(AuthFailure.class);
    }

    @Test void reciprocalAdminLocksCannotDisableBothActorsAndStaleAdminTokenIsRejected() throws Exception {
        var left = user("CREATOR"); var right = user("CREATOR");
        for (var user : List.of(left, right)) jdbc.update("insert into user_roles(user_id,role) values (?,'ADMIN')", user.id());
        var leftToken = as(identity.activeUser(left.id())); var rightToken = as(identity.activeUser(right.id()));
        var gate = new CountDownLatch(1);
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = pool.submit(() -> { gate.await(); return tryLock(left.id(), right.id()); });
            var second = pool.submit(() -> { gate.await(); return tryLock(right.id(), left.id()); });
            gate.countDown();
            assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder(true, false);
        }
        boolean leftLocked = adminUsers.detail(admin().id(), left.id()).status().equals("LOCKED");
        mvc.perform(get("/api/v1/admin/users").with(leftLocked ? leftToken : rightToken))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));
        mvc.perform(get("/api/v1/admin/audit-logs").with(leftLocked ? leftToken : rightToken)).andExpect(status().isForbidden());
    }

    @Test void disabledUserCannotBeReactivatedByLockOrUnlock() throws Exception {
        var target = user("PARTICIPANT"); var actor = admin();
        jdbc.update("update users set status='DISABLED' where id=?", target.id());
        for (String command : List.of("lock", "unlock"))
            mvc.perform(post("/api/v1/admin/users/" + target.id() + "/" + command).with(as(actor)))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_STATE_CONFLICT"));
        assertThat(adminUsers.detail(actor.id(), target.id()).status()).isEqualTo("DISABLED");
    }

    private boolean tryLock(UUID actor, UUID target) {
        try { adminUsers.status(actor, target, true); return true; }
        catch (AuthFailure ex) { assertThat(ex.code).isEqualTo("ACCOUNT_LOCKED"); return false; }
    }

    @Test void auditAndMutationRollbackTogetherAndAuditFailureCannotCommit() {
        var actor = admin(); var target = user("PARTICIPANT");
        assertThatThrownBy(() -> new TransactionTemplate(manager).executeWithoutResult(tx -> {
            adminUsers.status(actor.id(), target.id(), true);
            throw new IllegalStateException("Rollback test");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(identity.activeUser(target.id()).status()).isEqualTo("ACTIVE");
        assertThat(auditCount(target.id(), "ACCOUNT_LOCKED")).isZero();
        jdbc.execute("alter table audit_records add constraint test_admin_audit_failure check (target_id <> '" + target.id() + "')");
        try {
            assertThatThrownBy(() -> adminUsers.roles(actor.id(), target.id(), new RolesRequest(List.of("CREATOR")))).isInstanceOf(RuntimeException.class);
            assertThat(identity.activeUser(target.id()).roles()).containsExactly("PARTICIPANT");
            assertThat(auditCount(target.id(), "ROLE_CHANGED")).isZero();
        } finally { jdbc.execute("alter table audit_records drop constraint test_admin_audit_failure"); }
    }

    @Test void auditFiltersTimeBoundsPaginationAndMetadataAllowlist() throws Exception {
        var actor = admin(); var target = user("PARTICIPANT");
        var before = Instant.now().minusSeconds(1);
        adminUsers.status(actor.id(), target.id(), true); adminUsers.status(actor.id(), target.id(), false);
        jdbc.update("update audit_records set metadata=metadata || '{\"password\":\"never-expose\",\"rawToken\":\"never-expose\",\"requestBody\":\"never-expose\"}'::jsonb where target_id=?", target.id().toString());
        var response = mvc.perform(get("/api/v1/admin/audit-logs").with(as(actor)).param("actorUserId", actor.id().toString())
                .param("targetType", "User").param("targetId", target.id().toString()).param("action", "ACCOUNT_LOCKED")
                .param("from", before.toString()).param("to", Instant.now().plusSeconds(1).toString()).param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].metadata.oldStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.content[0].metadata.newStatus").value("LOCKED")).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("never-expose", "password", "rawToken", "requestBody");
        String time = json.readTree(response).get("content").get(0).get("occurredAt").asString();
        mvc.perform(get("/api/v1/admin/audit-logs").with(as(actor)).param("targetId", target.id().toString()).param("to", time))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/admin/audit-logs").with(as(actor)).param("targetId", target.id().toString()).param("size", "1").param("page", "1"))
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.content.length()").value(1));
        mvc.perform(get("/api/v1/admin/audit-logs").with(as(actor)).param("from", time).param("to", time)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/audit-logs").with(as(actor)).param("action", "INVALID")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/audit-logs").with(as(actor)).param("from", "invalid")).andExpect(status().isBadRequest());
    }

    private AuthDtos.UserSummary admin() {
        return identity.activeUser(jdbc.queryForObject("select id from users where email=?", UUID.class, ADMIN_EMAIL));
    }
    private AuthDtos.UserSummary user(String... roles) {
        return identity.register(new AuthDtos.RegisterRequest(UUID.randomUUID() + "@example.com", PASSWORD, "Admin test user", List.of(roles)));
    }
    private RequestPostProcessor as(AuthDtos.UserSummary user) {
        String token = tokens.issue(user, UUID.randomUUID().toString()).accessToken();
        return request -> { request.addHeader("Authorization", "Bearer " + token); return request; };
    }
    private long auditCount(UUID target, String action) {
        return jdbc.queryForObject("select count(*) from audit_records where target_id=? and action=?", Long.class, target.toString(), action);
    }
}
