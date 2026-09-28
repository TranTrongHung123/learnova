package com.learnova.identity;

import com.learnova.identity.controller.AuthController;
import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.security.RefreshSessions;
import com.learnova.identity.security.google.GoogleFlowStore;
import com.learnova.identity.service.GoogleAccounts;
import com.learnova.identity.service.IdentityService;
import com.learnova.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class GoogleOAuthIntegrationTests {
    static final FakeGoogleProvider provider = new FakeGoogleProvider(0);
    @DynamicPropertySource static void google(DynamicPropertyRegistry registry) {
        registry.add("learnova.auth.google.enabled", () -> true);
        registry.add("learnova.auth.google.client-id", () -> "test-client");
        registry.add("learnova.auth.google.client-secret", () -> "test-secret");
        registry.add("learnova.auth.google.authorization-uri", () -> provider.baseUrl() + "/authorize");
        registry.add("learnova.auth.google.token-uri", () -> provider.baseUrl() + "/token");
        registry.add("learnova.auth.google.jwk-set-uri", () -> provider.baseUrl() + "/jwks");
    }
    @AfterAll static void close() { provider.close(); }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired IdentityService local;
    @Autowired GoogleAccounts accounts;
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean GoogleFlowStore flows;
    @Autowired org.springframework.data.redis.core.StringRedisTemplate redis;
    @Autowired javax.sql.DataSource dataSource;
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean RefreshSessions sessions;

    @Test void newGoogleUsersChooseAllSupportedRoleCombinationsAndResume() throws Exception {
        for (var roles : List.of(List.of("PARTICIPANT"), List.of("CREATOR"), List.of("PARTICIPANT", "CREATOR"))) {
            String email = email();
            var callback = login(email, email, "valid");
            var pending = lastCookie(callback, GoogleFlowStore.COOKIE);
            assertThat(lastCookie(callback, AuthController.COOKIE)).isNull();
            mvc.perform(get("/api/v1/auth/google/flow").cookie(pending)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.state").value("ONBOARDING")).andExpect(header().string("Cache-Control", contains("no-store")));
            UUID id = jdbc.queryForObject("select id from users where email=?", UUID.class, email);
            assertThatThrownBy(() -> local.activeUser(id)).isInstanceOf(AuthFailure.class);
            var resumed = lastCookie(login(email, email, "valid"), GoogleFlowStore.COOKIE);
            for (var invalid : List.of(List.of("ADMIN"), List.<String>of(), List.of("CREATOR", "CREATOR")))
                mvc.perform(post("/api/v1/auth/google/onboarding").cookie(resumed).with(csrf()).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("roles", invalid)))).andExpect(status().isBadRequest());
            var completed = mvc.perform(post("/api/v1/auth/google/onboarding").cookie(resumed).with(csrf()).contentType("application/json")
                    .content(mapper.writeValueAsString(Map.of("roles", roles)))).andExpect(status().isNoContent()).andReturn().getResponse();
            mvc.perform(post("/api/v1/auth/refresh").cookie(lastCookie(completed, AuthController.COOKIE)).with(csrf()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value(id.toString()))
                    .andExpect(jsonPath("$.user.roles.length()").value(roles.size()));
            assertThat(local.activeUser(id).roles()).containsExactlyInAnyOrderElementsOf(roles);
            var again = login("changed-" + email, email, "valid");
            assertThat(lastCookie(again, AuthController.COOKIE)).isNotNull();
            assertThat(jdbc.queryForObject("select email from users where id=?", String.class, id)).isEqualTo(email);
        }
    }

    @Test void linkRequiresPasswordAndSeparateConfirmationAndPreservesUser() throws Exception {
        var user = local.register(new AuthDtos.RegisterRequest(email(), "long-password-123", "Local", List.of("CREATOR")));
        var pending = lastCookie(login(user.email(), "google-" + user.id(), "valid"), GoogleFlowStore.COOKIE);
        mvc.perform(post("/api/v1/auth/google/link/confirm").cookie(pending).with(csrf())).andExpect(status().isConflict());
        mvc.perform(post("/api/v1/auth/google/link/verify").cookie(pending).with(csrf()).contentType("application/json")
                .content("{\"password\":\"wrong\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/google/link/verify").cookie(pending).with(csrf()).contentType("application/json")
                .content("{\"password\":\"long-password-123\"}")).andExpect(status().isNoContent());
        assertThat(countIdentities(user.id())).isEqualTo(1);
        mvc.perform(get("/api/v1/auth/google/flow").cookie(pending)).andExpect(jsonPath("$.state").value("LINK_CONFIRMATION"));
        var linked = mvc.perform(post("/api/v1/auth/google/link/confirm").cookie(pending).with(csrf()))
                .andExpect(status().isNoContent()).andReturn().getResponse();
        assertThat(lastCookie(linked, AuthController.COOKIE)).isNotNull();
        assertThat(countIdentities(user.id())).isEqualTo(2);
        assertThat(local.authenticate(new AuthDtos.LoginRequest(user.email(), "long-password-123")).id()).isEqualTo(user.id());
        assertThat(jdbc.queryForObject("select count(*) from audit_records where target_id=? and action='GOOGLE_ACCOUNT_LINKED'", Integer.class, user.id().toString())).isEqualTo(1);
        mvc.perform(post("/api/v1/auth/google/link/confirm").cookie(pending).with(csrf())).andExpect(status().isUnauthorized());
    }

    @Test void rejectsInvalidTokensAndNeverCreatesUsers() throws Exception {
        for (var mode : List.of("signature", "issuer", "audience", "expired", "nonce", "unverified")) {
            String email = email();
            var response = login(email, email, mode);
            assertThat(response.getRedirectedUrl()).contains("error=");
            assertThat(lastCookie(response, AuthController.COOKIE)).isNull();
            assertThat(jdbc.queryForObject("select count(*) from users where email=?", Integer.class, email)).isZero();
        }
    }

    @Test void stateBrowserBindingAndReplayAreRejected() throws Exception {
        var start = start();
        var auth = start.getRedirectedUrl();
        var state = FakeGoogleProvider.params(URI.create(auth).getRawQuery()).get("state");
        var cookie = lastCookie(start, GoogleFlowStore.COOKIE);
        var code = provider.issue(auth, email(), UUID.randomUUID().toString(), "valid");
        mvc.perform(get("/api/v1/auth/google/callback").param("state", state).param("code", code))
                .andExpect(redirectedUrl("http://localhost:3000/auth/google/callback?error=GOOGLE_AUTH_FAILED"));
        mvc.perform(get("/api/v1/auth/google/callback").cookie(cookie).param("state", "wrong").param("code", code))
                .andExpect(redirectedUrl("http://localhost:3000/auth/google/callback?error=GOOGLE_AUTH_FAILED"));
        mvc.perform(get("/api/v1/auth/google/callback").cookie(cookie).param("state", state).param("code", code))
                .andExpect(redirectedUrl("http://localhost:3000/auth/google/callback"));
        mvc.perform(get("/api/v1/auth/google/callback").cookie(cookie).param("state", state).param("code", code))
                .andExpect(redirectedUrl("http://localhost:3000/auth/google/callback?error=GOOGLE_AUTH_FAILED"));
    }

    @Test void cancelCsrfAndExpiredFlowAreEnforced() throws Exception {
        var pending = lastCookie(login(email(), UUID.randomUUID().toString(), "valid"), GoogleFlowStore.COOKIE);
        mvc.perform(post("/api/v1/auth/google/cancel").cookie(pending)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/google/cancel").cookie(pending).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/auth/google/flow").cookie(pending)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/google/onboarding").cookie(pending).with(csrf()).contentType("application/json")
                .content("{\"roles\":[\"CREATOR\"]}")).andExpect(status().isUnauthorized());
    }

    @Test void pendingExpiresAndNewLoginInvalidatesPreviousBrowserFlow() throws Exception {
        var pending = lastCookie(login(email(), UUID.randomUUID().toString(), "valid"), GoogleFlowStore.COOKIE);
        var replacement = mvc.perform(get("/api/v1/auth/google").cookie(pending)).andExpect(status().is3xxRedirection()).andReturn().getResponse();
        mvc.perform(get("/api/v1/auth/google/flow").cookie(pending)).andExpect(status().isUnauthorized());
        var current = lastCookie(replacement, GoogleFlowStore.COOKIE);
        assertThat(current.getValue()).isNotEqualTo(pending.getValue());
        var expired = lastCookie(login(email(), UUID.randomUUID().toString(), "valid"), GoogleFlowStore.COOKIE);
        String hash = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(expired.getValue().getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        redis.expire("google:pending:" + hash, java.time.Duration.ZERO);
        mvc.perform(get("/api/v1/auth/google/flow").cookie(expired)).andExpect(status().isUnauthorized());
    }

    @Test void redisOutageDuringStartOrCallbackRedirectsSafely() throws Exception {
        var start = start();
        var cookie = lastCookie(start, GoogleFlowStore.COOKIE);
        var state = FakeGoogleProvider.params(URI.create(start.getRedirectedUrl()).getRawQuery()).get("state");
        org.mockito.Mockito.doThrow(new org.springframework.data.redis.RedisConnectionFailureException("test outage"))
                .when(flows).put(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
        try {
            mvc.perform(get("/api/v1/auth/google"))
                    .andExpect(redirectedUrl("http://localhost:3000/auth/google/callback?error=SERVICE_UNAVAILABLE"));
        } finally { org.mockito.Mockito.reset(flows); }
        org.mockito.Mockito.doThrow(new org.springframework.data.redis.RedisConnectionFailureException("test outage"))
                .when(flows).get(org.mockito.ArgumentMatchers.eq("oauth"), org.mockito.ArgumentMatchers.anyString());
        try {
            mvc.perform(get("/api/v1/auth/google/callback").cookie(cookie).param("state", state).param("code", "test"))
                    .andExpect(redirectedUrl("http://localhost:3000/auth/google/callback?error=SERVICE_UNAVAILABLE"));
        } finally { org.mockito.Mockito.reset(flows); }
    }

    @Test void passwordAttemptLimitDoesNotCreateIdentity() throws Exception {
        var user = local.register(new AuthDtos.RegisterRequest(email(), "long-password-123", "Local", List.of("CREATOR")));
        var pending = lastCookie(login(user.email(), user.email(), "valid"), GoogleFlowStore.COOKIE);
        for (int i = 0; i < 5; i++)
            mvc.perform(post("/api/v1/auth/google/link/verify").cookie(pending).with(csrf()).contentType("application/json")
                    .content("{\"password\":\"wrong\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/google/link/verify").cookie(pending).with(csrf()).contentType("application/json")
                .content("{\"password\":\"long-password-123\"}")).andExpect(status().isTooManyRequests());
        assertThat(countIdentities(user.id())).isEqualTo(1);
    }

    @Test void sessionFailureAfterCommitCanRecoverOnNextGoogleLogin() throws Exception {
        String email = email();
        var pending = lastCookie(login(email, email, "valid"), GoogleFlowStore.COOKIE);
        org.mockito.Mockito.doThrow(new org.springframework.data.redis.RedisConnectionFailureException("test outage"))
                .when(sessions).create(org.mockito.ArgumentMatchers.any());
        try {
            var response = mvc.perform(post("/api/v1/auth/google/onboarding").cookie(pending).with(csrf()).contentType("application/json")
                    .content("{\"roles\":[\"CREATOR\"]}")).andExpect(status().isServiceUnavailable()).andReturn().getResponse();
            assertThat(lastCookie(response, AuthController.COOKIE)).isNull();
        } finally { org.mockito.Mockito.reset(sessions); }
        assertThat(lastCookie(login(email, email, "valid"), AuthController.COOKIE)).isNotNull();
        assertThat(jdbc.queryForObject("select count(*) from users where email=?", Integer.class, email)).isEqualTo(1);
    }

    @Test void migrationPreservesExistingLocalUsers() {
        String schema = "migration_" + UUID.randomUUID().toString().replace("-", "");
        var old = org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                .target("2").load();
        old.migrate();
        UUID id = UUID.randomUUID();
        jdbc.update("insert into " + schema + ".users (id,email,display_name,status,created_at) values (?,?,?,'ACTIVE',now())", id, email(), "Existing User");
        jdbc.update("insert into " + schema + ".user_roles (user_id,role) values (?,'PARTICIPANT')", id);
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
        assertThat(jdbc.queryForObject("select onboarding_completed from " + schema + ".users where id=?", Boolean.class, id)).isTrue();
        assertThat(jdbc.queryForObject("select role from " + schema + ".user_roles where user_id=?", String.class, id)).isEqualTo("PARTICIPANT");
    }

    @Test void lockedAccountCannotLoginOrCompletePendingLink() throws Exception {
        var user = local.register(new AuthDtos.RegisterRequest(email(), "long-password-123", "Local", List.of("PARTICIPANT")));
        var pending = lastCookie(login(user.email(), user.email(), "valid"), GoogleFlowStore.COOKIE);
        mvc.perform(post("/api/v1/auth/google/link/verify").cookie(pending).with(csrf()).contentType("application/json")
                .content("{\"password\":\"long-password-123\"}")).andExpect(status().isNoContent());
        jdbc.update("update users set status='LOCKED' where id=?", user.id());
        mvc.perform(post("/api/v1/auth/google/link/confirm").cookie(pending).with(csrf())).andExpect(status().isForbidden());
        assertThat(login(user.email(), user.email(), "valid").getRedirectedUrl()).contains("error=ACCOUNT_LOCKED");
        assertThat(countIdentities(user.id())).isEqualTo(1);
    }

    @Test void concurrentCallbacksAndOnboardingDoNotDuplicateOrOverwriteRoles() throws Exception {
        String email = email();
        var found = race(() -> accounts.recognize(email, email, "A"), () -> accounts.recognize(email, email, "A"));
        assertThat(found.get(0).userId()).isEqualTo(found.get(1).userId());
        race(() -> accounts.onboard(found.get(0), List.of("CREATOR")), () -> accounts.onboard(found.get(1), List.of("PARTICIPANT")));
        assertThat(local.activeUser(found.get(0).userId()).roles()).hasSize(1);
        assertThat(countIdentities(found.get(0).userId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from audit_records where target_id=? and action='ONBOARDING_COMPLETED'", Integer.class, found.get(0).userId().toString())).isEqualTo(1);
    }

    @Test void concurrentLinksCreateOneIdentityAndCannotMoveItToAnotherUser() throws Exception {
        var user = local.register(new AuthDtos.RegisterRequest(email(), "long-password-123", "Local", List.of("PARTICIPANT")));
        var pending = new GoogleFlowStore.Pending("LINK_CONFIRMATION", user.id(), UUID.randomUUID().toString(), user.email());
        var linked = race(() -> accounts.link(pending), () -> accounts.link(pending));
        assertThat(linked).containsOnly(user.id());
        var other = local.register(new AuthDtos.RegisterRequest(email(), "long-password-123", "Other", List.of("CREATOR")));
        assertThatThrownBy(() -> accounts.link(new GoogleFlowStore.Pending("LINK_CONFIRMATION", other.id(), pending.subject(), other.email())))
                .isInstanceOf(AuthFailure.class);
        assertThat(countIdentities(user.id())).isEqualTo(2);
        assertThat(countIdentities(other.id())).isEqualTo(1);
    }

    private MockHttpServletResponse start() throws Exception {
        var response = mvc.perform(get("/api/v1/auth/google")).andExpect(status().is3xxRedirection()).andReturn().getResponse();
        assertThat(response.getRedirectedUrl()).contains("code_challenge_method=S256", "nonce=", "state=");
        assertThat(response.getCookie("JSESSIONID")).isNull();
        return response;
    }
    private MockHttpServletResponse login(String email, String subject, String mode) throws Exception {
        var start = start();
        var params = FakeGoogleProvider.params(URI.create(start.getRedirectedUrl()).getRawQuery());
        String code = provider.issue(start.getRedirectedUrl(), email, subject, mode);
        return mvc.perform(get("/api/v1/auth/google/callback").cookie(lastCookie(start, GoogleFlowStore.COOKIE))
                .param("state", params.get("state")).param("code", code)).andExpect(status().is3xxRedirection()).andReturn().getResponse();
    }
    private RequestPostProcessor csrf() throws Exception {
        var response = mvc.perform(get("/api/v1/auth/csrf")).andReturn().getResponse();
        var token = mapper.readTree(response.getContentAsString()).get("token").asText();
        return request -> {
            var cookies = new java.util.ArrayList<Cookie>();
            if (request.getCookies() != null) cookies.addAll(List.of(request.getCookies()));
            cookies.add(response.getCookie("XSRF-TOKEN"));
            request.setCookies(cookies.toArray(Cookie[]::new));
            request.addHeader("X-XSRF-TOKEN", token);
            return request;
        };
    }
    private static Cookie lastCookie(MockHttpServletResponse response, String name) {
        Cookie result = null;
        for (var cookie : response.getCookies()) if (cookie.getName().equals(name)) result = cookie;
        return result;
    }
    private int countIdentities(UUID id) { return jdbc.queryForObject("select count(*) from auth_identities where user_id=?", Integer.class, id); }
    private static String email() { return UUID.randomUUID() + "@example.com"; }
    private static org.hamcrest.Matcher<String> contains(String value) { return org.hamcrest.Matchers.containsString(value); }
    private static <T> List<T> race(Callable<T> one, Callable<T> two) throws Exception {
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var ready = new CountDownLatch(2);
            var release = new CountDownLatch(1);
            var first = executor.submit(() -> { ready.countDown(); release.await(); return one.call(); });
            var second = executor.submit(() -> { ready.countDown(); release.await(); return two.call(); });
            ready.await(); release.countDown();
            return List.of(first.get(), second.get());
        }
    }
}
