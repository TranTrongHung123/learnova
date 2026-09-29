package com.learnova.identity;

import com.learnova.TestcontainersConfiguration;
import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.dto.ProfileDtos;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.security.RefreshSessions;
import com.learnova.identity.security.AccessTokens;
import com.learnova.identity.service.IdentityService;
import com.learnova.identity.service.ProfileService;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
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
class ProfileIntegrationTests {
    private static final String OLD = "Old password test 123";
    private static final String NEW = "New password test 456";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired IdentityService identity;
    @Autowired ProfileService profiles;
    @Autowired RefreshSessions sessions;
    @Autowired AccessTokens accessTokens;
    @Autowired JdbcTemplate jdbc;
    @Autowired StringRedisTemplate redis;
    @Autowired PlatformTransactionManager manager;
    @Autowired DataSource dataSource;

    @Test void readsAndUpdatesOnlyOwnProfileAndAuthSummary() throws Exception {
        var user = user(); var other = user();
        mvc.perform(get("/api/v1/auth/profile").with(as(user)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(user.id().toString()))
                .andExpect(jsonPath("$.createdAt").isString()).andExpect(jsonPath("$.hasLocalIdentity").value(true))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(put("/api/v1/auth/profile").with(as(user)).with(csrf()).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("displayName", "  Tên mới 😀  ", "avatarUrl", "https://example.com/avatar.png"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.displayName").value("Tên mới 😀"))
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/avatar.png"));
        mvc.perform(get("/api/v1/auth/me").with(as(user))).andExpect(jsonPath("$.avatarUrl").value("https://example.com/avatar.png"));
        assertThat(profiles.get(other.id()).displayName()).isEqualTo("Test");
        assertThat(profiles.update(user.id(), new ProfileDtos.UpdateProfile("Test", "  ")).avatarUrl()).isNull();
        assertThat(profiles.update(user.id(), new ProfileDtos.UpdateProfile("😀".repeat(100), null)).displayName()).hasSize(200);
    }

    @Test void rejectsMassAssignmentWithoutPartialUpdate() throws Exception {
        var user = user();
        for (String field : List.of("email", "roles", "role", "status", "id", "createdAt", "hasLocalIdentity", "passwordHash")) {
            mvc.perform(put("/api/v1/auth/profile").with(as(user)).with(csrf()).contentType("application/json")
                            .content(mapper.writeValueAsString(Map.of("displayName", "Changed", field, "untrusted"))))
                    .andExpect(status().isBadRequest());
        }
        assertThat(profiles.get(user.id()).displayName()).isEqualTo("Test");
        assertThat(profiles.get(user.id()).email()).isEqualTo(user.email());
        assertThat(profiles.get(user.id()).roles()).containsExactly("PARTICIPANT");
    }

    @Test void validatesNameAndHttpsUrl() throws Exception {
        var user = user();
        for (String url : List.of("http://example.com/a", "javascript:alert(1)", "data:image/png,abc", "//example.com/a",
                "https://user:pass@example.com/a", "https:///missing", "https://example.com:70000/a", "https://example.com/" + "a".repeat(2048))) {
            mvc.perform(put("/api/v1/auth/profile").with(as(user)).with(csrf()).contentType("application/json")
                            .content(mapper.writeValueAsString(Map.of("displayName", "Test", "avatarUrl", url))))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        for (String name : List.of("  ", "a".repeat(101)))
            mvc.perform(put("/api/v1/auth/profile").with(as(user)).with(csrf()).contentType("application/json")
                    .content(mapper.writeValueAsString(Map.of("displayName", name))))
                    .andExpect(status().isBadRequest());
    }

    @Test void enforcesAuthenticationCsrfStatusAndOnboardingForEveryRole() throws Exception {
        mvc.perform(get("/api/v1/auth/profile")).andExpect(status().isUnauthorized());
        var user = user();
        mvc.perform(put("/api/v1/auth/profile").with(as(user)).contentType("application/json").content("{\"displayName\":\"Test\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        mvc.perform(post("/api/v1/auth/change-password").with(as(user)).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        for (String role : List.of("PARTICIPANT", "CREATOR", "ADMIN")) {
            jdbc.update("update user_roles set role=? where user_id=?", role, user.id());
            mvc.perform(get("/api/v1/auth/profile").with(as(user))).andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value(role));
        }
        for (String state : List.of("LOCKED", "DISABLED")) {
            jdbc.update("update users set status=? where id=?", state, user.id());
            mvc.perform(get("/api/v1/auth/profile").with(as(user))).andExpect(status().isForbidden());
            mvc.perform(put("/api/v1/auth/profile").with(as(user)).with(csrf()).contentType("application/json").content("{\"displayName\":\"Test\"}"))
                    .andExpect(status().isForbidden());
            assertThatThrownBy(() -> profiles.changePassword(user.id(), UUID.randomUUID().toString(), new ProfileDtos.ChangePassword(OLD, NEW)))
                    .isInstanceOf(AuthFailure.class);
        }
        jdbc.update("update users set status='ACTIVE', onboarding_completed=false where id=?", user.id());
        mvc.perform(get("/api/v1/auth/profile").with(as(user))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ONBOARDING_REQUIRED"));
    }

    @Test void changesPasswordKeepsCurrentSessionAndAuditsWithoutSecrets() throws Exception {
        var user = user(); var current = sessions.create(user.id()); var other = sessions.create(user.id());
        var unrelated = sessions.create(UUID.randomUUID());
        mvc.perform(post("/api/v1/auth/change-password").with(as(user, current.session().sessionId())).with(csrf())
                        .contentType("application/json").content(mapper.writeValueAsString(Map.of("currentPassword", OLD, "newPassword", NEW))))
                .andExpect(status().isNoContent()).andExpect(cookie().doesNotExist("learnova_refresh"));
        assertThat(identity.authenticate(new AuthDtos.LoginRequest(user.email(), NEW)).id()).isEqualTo(user.id());
        assertThatThrownBy(() -> identity.authenticate(new AuthDtos.LoginRequest(user.email(), OLD))).isInstanceOf(AuthFailure.class);
        assertThat(sessions.rotate(current.token(), current.session()).session().expiresAt()).isEqualTo(current.session().expiresAt());
        assertThatThrownBy(() -> sessions.rotate(other.token(), other.session())).isInstanceOf(AuthFailure.class);
        assertThat(sessions.rotate(unrelated.token(), unrelated.session())).isNotNull();
        assertThat(jdbc.queryForObject("select count(*) from audit_records where actor_user_id=? and action='PASSWORD_CHANGED'", Integer.class, user.id().toString())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select metadata::text from audit_records where actor_user_id=?", String.class, user.id().toString())).isEqualTo("{}");
    }

    @Test void wrongPasswordAndInvalidNewPasswordNeverRevokeSessions() throws Exception {
        var user = user(); var current = sessions.create(user.id()); var other = sessions.create(user.id());
        mvc.perform(post("/api/v1/auth/change-password").with(as(user, current.session().sessionId())).with(csrf()).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("currentPassword", "wrong", "newPassword", NEW))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INCORRECT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("currentPassword"));
        for (String password : List.of("x".repeat(11), "😀".repeat(129)))
            mvc.perform(post("/api/v1/auth/change-password").with(as(user, current.session().sessionId())).with(csrf()).contentType("application/json")
                    .content(mapper.writeValueAsString(Map.of("currentPassword", OLD, "newPassword", password))))
                    .andExpect(status().isBadRequest());
        assertThat(sessions.rotate(other.token(), other.session())).isNotNull();
        assertThat(identity.authenticate(new AuthDtos.LoginRequest(user.email(), OLD))).isNotNull();
    }

    @Test void unicodeAndWhitespacePasswordsUseExistingPolicy() throws Exception {
        var user = user(); var current = sessions.create(user.id()); String previous = OLD;
        for (String password : List.of("😀".repeat(12), "😀".repeat(128), " ".repeat(12))) {
            profiles.changePassword(user.id(), current.session().sessionId(), new ProfileDtos.ChangePassword(previous, password));
            assertThat(identity.authenticate(new AuthDtos.LoginRequest(user.email(), password))).isNotNull(); previous = password;
        }
    }

    @Test void rejectsGoogleOnlyButAllowsLinkedUser() throws Exception {
        var user = user(); var current = sessions.create(user.id());
        jdbc.update("insert into auth_identities (id,user_id,provider,provider_subject) values (?,?,'GOOGLE',?)", UUID.randomUUID(), user.id(), UUID.randomUUID().toString());
        assertThat(profiles.get(user.id()).hasLocalIdentity()).isTrue();
        profiles.changePassword(user.id(), current.session().sessionId(), new ProfileDtos.ChangePassword(OLD, NEW));
        jdbc.update("delete from auth_identities where user_id=? and provider='LOCAL'", user.id());
        assertThat(profiles.get(user.id()).hasLocalIdentity()).isFalse();
        mvc.perform(post("/api/v1/auth/change-password").with(as(user, current.session().sessionId())).with(csrf()).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("currentPassword", NEW, "newPassword", OLD))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("LOCAL_IDENTITY_REQUIRED"));
    }

    @Test void requiresActiveSessionOwnedByUser() {
        var user = user(); var current = sessions.create(user.id()); var foreign = sessions.create(UUID.randomUUID());
        sessions.revoke(current.session());
        for (String sid : List.of(current.session().sessionId(), foreign.session().sessionId(), "invalid")) {
            assertThatThrownBy(() -> profiles.changePassword(user.id(), sid, new ProfileDtos.ChangePassword(OLD, NEW)))
                    .isInstanceOfSatisfying(AuthFailure.class, failure -> assertThat(failure.status).isEqualTo(401));
        }
        assertThat(identity.authenticate(new AuthDtos.LoginRequest(user.email(), OLD))).isNotNull();
        assertThat(sessions.rotate(foreign.token(), foreign.session())).isNotNull();
    }

    @Test void concurrentChangesAllowOnlyOneOldPassword() throws Exception {
        var user = user(); var current = sessions.create(user.id());
        assertThat(race(() -> change(user, current), () -> change(user, current))).containsExactlyInAnyOrder("OK", "CURRENT_PASSWORD_INCORRECT");
        assertThat(sessions.rotate(current.token(), current.session())).isNotNull();
    }

    @Test void loginWithOldPasswordCannotLeaveNewSessionAfterPasswordChange() throws Exception {
        var user = user(); var current = sessions.create(user.id());
        var results = race(() -> {
            try { return identity.login(new AuthDtos.LoginRequest(user.email(), OLD), null).issued(); }
            catch (AuthFailure failure) { return failure.code; }
        }, () -> change(user, current));
        assertThat(results).contains("OK");
        for (Object result : results) {
            if (result instanceof RefreshSessions.Issued issued)
                assertThatThrownBy(() -> sessions.rotate(issued.token(), issued.session())).isInstanceOf(AuthFailure.class);
            else assertThat(result).isIn("OK", "INVALID_CREDENTIALS");
        }
    }

    @Test void refreshAndLogoutRacesDoNotRestoreRevokedSessions() throws Exception {
        var user = user(); var current = sessions.create(user.id()); var other = sessions.create(user.id());
        var results = race(() -> change(user, current), () -> {
            try { return sessions.rotate(other.token(), other.session()); }
            catch (AuthFailure failure) { return failure.code; }
        });
        assertThat(results).contains("OK");
        for (Object result : results) if (result instanceof RefreshSessions.Issued issued)
            assertThatThrownBy(() -> sessions.rotate(issued.token(), issued.session())).isInstanceOf(AuthFailure.class);
        var second = user(); var active = sessions.create(second.id());
        race(() -> change(second, active), () -> { sessions.revokeAll(second.id()); return "LOGOUT"; });
        assertThatThrownBy(() -> sessions.rotate(active.token(), active.session())).isInstanceOf(AuthFailure.class);
    }

    @Test void databaseRollbackPreservesPasswordAndAuditButDoesNotUndoRedisRevocation() {
        var user = user(); var current = sessions.create(user.id()); var other = sessions.create(user.id());
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            profiles.changePassword(user.id(), current.session().sessionId(), new ProfileDtos.ChangePassword(OLD, NEW));
            status.setRollbackOnly();
        });
        assertThat(identity.authenticate(new AuthDtos.LoginRequest(user.email(), OLD))).isNotNull();
        assertThat(jdbc.queryForObject("select count(*) from audit_records where actor_user_id=?", Integer.class, user.id().toString())).isZero();
        assertThatThrownBy(() -> sessions.rotate(other.token(), other.session())).isInstanceOf(AuthFailure.class);
        assertThat(sessions.rotate(current.token(), current.session())).isNotNull();
    }

    @Test void redisOutageDoesNotCommitPasswordOrAudit() throws Exception {
        var user = user(); var current = sessions.create(user.id()); var csrf = csrf();
        redis.execute((org.springframework.data.redis.core.RedisCallback<Object>) connection -> connection.execute("CLIENT", "PAUSE".getBytes(), "4000".getBytes(), "ALL".getBytes()));
        mvc.perform(post("/api/v1/auth/change-password").with(as(user, current.session().sessionId())).with(csrf).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("currentPassword", OLD, "newPassword", NEW))))
                .andExpect(status().isServiceUnavailable());
        assertThat(identity.authenticate(new AuthDtos.LoginRequest(user.email(), OLD))).isNotNull();
        assertThat(jdbc.queryForObject("select count(*) from audit_records where actor_user_id=?", Integer.class, user.id().toString())).isZero();
        org.awaitility.Awaitility.await().atMost(Duration.ofSeconds(8)).untilAsserted(() ->
                assertThat(redis.execute((org.springframework.data.redis.core.RedisCallback<String>) connection -> connection.ping())).isEqualTo("PONG"));
    }

    @Test void migrationFromF04PreservesUsersAndCredentials() {
        String schema = "profile_" + UUID.randomUUID().toString().replace("-", "");
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("3").load().migrate();
        var id = UUID.randomUUID();
        jdbc.update("insert into " + schema + ".users (id,email,display_name,status,created_at,onboarding_completed) values (?,?,'Existing','ACTIVE',now(),true)", id, id + "@example.com");
        jdbc.update("insert into " + schema + ".user_roles values (?,'PARTICIPANT')", id);
        jdbc.update("insert into " + schema + ".auth_identities values (?,?,'LOCAL',?,'existing-hash')", UUID.randomUUID(), id, id + "@example.com");
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
        assertThat(jdbc.queryForObject("select avatar_url from " + schema + ".users where id=?", String.class, id)).isNull();
        assertThat(jdbc.queryForObject("select password_hash from " + schema + ".auth_identities where user_id=?", String.class, id)).isEqualTo("existing-hash");
        assertThat(jdbc.queryForObject("select role from " + schema + ".user_roles where user_id=?", String.class, id)).isEqualTo("PARTICIPANT");
    }

    private String change(AuthDtos.UserSummary user, RefreshSessions.Issued current) {
        try { profiles.changePassword(user.id(), current.session().sessionId(), new ProfileDtos.ChangePassword(OLD, NEW)); return "OK"; }
        catch (AuthFailure failure) { return failure.code; }
    }
    private AuthDtos.UserSummary user() { return identity.register(new AuthDtos.RegisterRequest(UUID.randomUUID() + "@example.com", OLD, "Test", List.of("PARTICIPANT"))); }
    private RequestPostProcessor as(AuthDtos.UserSummary user) { return as(user, UUID.randomUUID().toString()); }
    private RequestPostProcessor as(AuthDtos.UserSummary user, String sid) {
        String token = accessTokens.issue(user, sid).accessToken();
        return request -> { request.addHeader("Authorization", "Bearer " + token); return request; };
    }
    private RequestPostProcessor csrf() throws Exception {
        var response = mvc.perform(get("/api/v1/auth/csrf")).andReturn().getResponse(); var body = mapper.readTree(response.getContentAsString());
        return request -> { request.setCookies(new Cookie[]{response.getCookie("XSRF-TOKEN")}); request.addHeader(body.get("headerName").asText(), body.get("token").asText()); return request; };
    }
    private <T> List<T> race(Callable<T> first, Callable<T> second) throws Exception {
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var a = executor.submit(() -> { gate.await(); return first.call(); }); var b = executor.submit(() -> { gate.await(); return second.call(); });
            gate.countDown(); return List.of(a.get(), b.get());
        }
    }
}
