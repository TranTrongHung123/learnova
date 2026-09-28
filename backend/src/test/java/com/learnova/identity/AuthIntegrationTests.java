package com.learnova.identity;

import com.learnova.identity.controller.AuthController;
import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.security.AccessTokens;
import com.learnova.identity.security.RefreshSessions;
import com.learnova.identity.service.IdentityService;
import com.learnova.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired IdentityService identity;
    @Autowired RefreshSessions sessions;
    @Autowired StringRedisTemplate redis;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtDecoder decoder;
    @Autowired AccessTokens accessTokens;

    @Test
    void registrationLoginMeAndLogoutUseActualContracts() throws Exception {
        String email = email();
        var created = mvc.perform(post("/api/v1/auth/register").with(realCsrf()).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("email", " " + email.toUpperCase() + " ",
                                "password", "Mật khẩu an toàn 😀", "displayName", "Người dùng", "roles", List.of("PARTICIPANT", "CREATOR")))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.roles.length()").value(2)).andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(header().doesNotExist("Set-Cookie")).andReturn();
        String id = mapper.readTree(created.getResponse().getContentAsString()).get("id").asText();
        assertThat(jdbc.queryForObject("select password_hash from auth_identities where user_id=?", String.class, UUID.fromString(id)))
                .startsWith("{pbkdf2-sha256-600k}").doesNotContain("Mật khẩu");
        var login = mvc.perform(post("/api/v1/auth/login").with(realCsrf()).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", "Mật khẩu an toàn 😀"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.expiresIn").value(900)).andReturn().getResponse();
        var cookie = login.getCookie(AuthController.COOKIE);
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/api/v1/auth");
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Lax");
        String token = mapper.readTree(login.getContentAsString()).get("accessToken").asText();
        assertThat(decoder.decode(token).getClaimAsStringList("roles")).containsExactly("CREATOR", "PARTICIPANT");
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(post("/api/v1/auth/logout").with(realCsrf()).cookie(cookie)).andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/auth/refresh").with(realCsrf()).cookie(cookie)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/logout").with(realCsrf()).cookie(cookie)).andExpect(status().isNoContent());
    }

    @Test
    void csrfAndCorsWorkWithoutHttpSession() throws Exception {
        var response = mvc.perform(get("/api/v1/auth/csrf").header("Origin", "http://localhost:3000"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true")).andReturn().getResponse();
        var json = mapper.readTree(response.getContentAsString());
        assertThat(response.getCookie("JSESSIONID")).isNull();
        mvc.perform(post("/api/v1/auth/logout").cookie(response.getCookie("XSRF-TOKEN"))
                        .header(json.get("headerName").asText(), json.get("token").asText()))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/auth/logout")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        mvc.perform(post("/api/v1/auth/logout").cookie(response.getCookie("XSRF-TOKEN")).header("X-XSRF-TOKEN", "wrong"))
                .andExpect(status().isForbidden());
        mvc.perform(options("/api/v1/auth/login").header("Origin", "https://evil.example")
                .header("Access-Control-Request-Method", "POST")).andExpect(status().isForbidden());
    }

    @Test
    void rejectsRoleEscalationAndPasswordBounds() throws Exception {
        for (List<String> roles : List.of(List.of("ADMIN"), List.of("PARTICIPANT", "ADMIN"), List.of("STUDENT"), List.of("PARTICIPANT", "PARTICIPANT"), List.<String>of())) {
            mvc.perform(post("/api/v1/auth/register").with(realCsrf()).contentType("application/json")
                    .content(mapper.writeValueAsString(Map.of("email", email(), "password", "long-password-123", "displayName", "A", "roles", roles))))
                    .andExpect(status().isBadRequest());
        }
        for (String password : List.of("a".repeat(11), "😀".repeat(129))) {
            mvc.perform(post("/api/v1/auth/register").with(realCsrf()).contentType("application/json")
                    .content(mapper.writeValueAsString(Map.of("email", email(), "password", password, "displayName", "A", "roles", List.of("CREATOR")))))
                    .andExpect(status().isBadRequest());
        }
        for (String password : List.of("😀".repeat(12), "😀".repeat(128), " ".repeat(12))) {
            var user = identity.register(new AuthDtos.RegisterRequest(email(), password, "A", List.of("PARTICIPANT")));
            assertThat(identity.authenticate(new AuthDtos.LoginRequest(user.email(), password)).id()).isEqualTo(user.id());
        }
    }

    @Test
    void duplicateEmailRaceCreatesExactlyOneUserAndIdentity() throws Exception {
        String email = email();
        var results = race(() -> registerStatus(email), () -> registerStatus(" " + email.toUpperCase() + " "));
        assertThat(results).containsExactlyInAnyOrder(201, 409);
        assertThat(jdbc.queryForObject("select count(*) from users where email=?", Integer.class, email)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from auth_identities where provider_subject=?", Integer.class, email)).isEqualTo(1);
    }

    @Test
    void wrongCredentialsDoNotRevealLockedAccountAndRefreshIsBlocked() throws Exception {
        var user = user();
        var refresh = sessions.create(user.id());
        for (String status : List.of("LOCKED", "DISABLED")) {
            jdbc.update("update users set status=? where id=?", status, user.id());
            mvc.perform(post("/api/v1/auth/login").with(realCsrf()).contentType("application/json")
                    .content(mapper.writeValueAsString(Map.of("email", user.email(), "password", "wrong"))))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
            mvc.perform(post("/api/v1/auth/login").with(realCsrf()).contentType("application/json")
                    .content(mapper.writeValueAsString(Map.of("email", user.email(), "password", "long-password-123"))))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_" + status));
            mvc.perform(post("/api/v1/auth/refresh").with(realCsrf()).cookie(new Cookie(AuthController.COOKIE, refresh.token())))
                    .andExpect(status().isForbidden());
        }
        jdbc.update("update users set status='ACTIVE' where id=?", user.id());
        assertThatThrownBy(() -> sessions.rotate(refresh.token(), refresh.session())).isInstanceOf(AuthFailure.class);
    }

    @Test
    void concurrentRefreshRevokesFamilyAfterExactlyOneRotation() throws Exception {
        var initial = sessions.create(UUID.randomUUID());
        var results = race(() -> rotateOrCode(initial), () -> rotateOrCode(initial));
        assertThat(results.stream().filter(value -> value instanceof RefreshSessions.Issued)).hasSize(1);
        assertThat(results).contains("REFRESH_REUSED");
        var rotated = (RefreshSessions.Issued) results.stream().filter(value -> value instanceof RefreshSessions.Issued).findFirst().orElseThrow();
        assertThatThrownBy(() -> sessions.rotate(rotated.token(), rotated.session())).isInstanceOf(AuthFailure.class);
        assertThat(rotated.session().expiresAt()).isEqualTo(initial.session().expiresAt());
    }

    @Test
    void logoutAllInvalidatesEveryDeviceAndDoesNotAffectAnotherUser() throws Exception {
        var user = user();
        var one = sessions.create(user.id());
        var two = sessions.create(user.id());
        var other = sessions.create(UUID.randomUUID());
        mvc.perform(post("/api/v1/auth/logout-all").with(realCsrf()).with(jwt().jwt(jwt -> jwt.subject(user.id().toString()))))
                .andExpect(status().isNoContent());
        for (var issued : List.of(one, two))
            assertThatThrownBy(() -> sessions.rotate(issued.token(), issued.session())).isInstanceOf(AuthFailure.class);
        assertThat(sessions.rotate(other.token(), other.session())).isNotNull();
    }

    @Test
    void logoutRacesCannotResurrectSession() throws Exception {
        for (boolean all : List.of(false, true)) {
            var initial = sessions.create(UUID.randomUUID());
            var results = race(() -> rotateOrCode(initial), () -> {
                if (all) sessions.revokeAll(initial.session().userId()); else sessions.revoke(initial.session());
                return "LOGOUT";
            });
            for (var result : results) if (result instanceof RefreshSessions.Issued issued)
                assertThatThrownBy(() -> sessions.rotate(issued.token(), issued.session())).isInstanceOf(AuthFailure.class);
            assertThatThrownBy(() -> sessions.rotate(initial.token(), initial.session())).isInstanceOf(AuthFailure.class);
        }
    }

    @Test
    void expiryAndJwtValidationAreEnforced() throws Exception {
        var user = user();
        var initial = sessions.create(user.id());
        var future = new RefreshSessions(redis, Clock.fixed(Instant.now().plus(Duration.ofDays(8)), ZoneOffset.UTC));
        assertThatThrownBy(() -> future.lookup(initial.token())).isInstanceOf(AuthFailure.class);
        var jwt = accessTokens.issue(user, initial.session().sessionId()).accessToken();
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + jwt + "tamper"))
                .andExpect(status().isUnauthorized());
        var expired = org.springframework.security.oauth2.jwt.JwtClaimsSet.builder().issuer("learnova")
                .audience(List.of("learnova-api")).subject(user.id().toString())
                .issuedAt(Instant.now().minusSeconds(2000)).expiresAt(Instant.now().minusSeconds(1000)).build();
        String expiredToken = encoder.encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(
                org.springframework.security.oauth2.jwt.JwsHeader.with(org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build(), expired)).getTokenValue();
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + expiredToken)).andExpect(status().isUnauthorized());
    }
    @Autowired org.springframework.security.oauth2.jwt.JwtEncoder encoder;

    @Test
    void redisUnavailableReturns503WithoutIssuingCookie() throws Exception {
        var user = user();
        var csrf = realCsrf();
        redis.execute((org.springframework.data.redis.core.RedisCallback<Object>) connection ->
                connection.execute("CLIENT", "PAUSE".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                        "4000".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                        "ALL".getBytes(java.nio.charset.StandardCharsets.US_ASCII)));
        mvc.perform(post("/api/v1/auth/login").with(csrf).contentType("application/json")
                .content(mapper.writeValueAsString(Map.of("email", user.email(), "password", "long-password-123"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"))
                .andExpect(cookie().doesNotExist(AuthController.COOKIE));
        // Redis tự tiếp tục sau pause; chờ PING thành công trước khi test khác dùng cùng container.
        org.awaitility.Awaitility.await().atMost(Duration.ofSeconds(8)).untilAsserted(() ->
                assertThat(redis.execute((org.springframework.data.redis.core.RedisCallback<String>) connection -> connection.ping())).isEqualTo("PONG"));
    }

    private Object rotateOrCode(RefreshSessions.Issued issued) {
        try { return sessions.rotate(issued.token(), issued.session()); }
        catch (AuthFailure failure) { return failure.code; }
    }
    private org.springframework.test.web.servlet.request.RequestPostProcessor realCsrf() throws Exception {
        // csrf() của Spring Test thay repository; ở đây kiểm tra cookie/header thật.
        var response = mvc.perform(get("/api/v1/auth/csrf")).andReturn().getResponse();
        var body = mapper.readTree(response.getContentAsString());
        return request -> {
            var existing = request.getCookies();
            var cookies = new java.util.ArrayList<Cookie>();
            if (existing != null) cookies.addAll(List.of(existing));
            cookies.add(response.getCookie("XSRF-TOKEN"));
            request.setCookies(cookies.toArray(Cookie[]::new));
            request.addHeader(body.get("headerName").asText(), body.get("token").asText());
            return request;
        };
    }
    private int registerStatus(String email) throws Exception {
        return mvc.perform(post("/api/v1/auth/register").with(realCsrf()).contentType("application/json")
                .content(mapper.writeValueAsString(Map.of("email", email, "password", "long-password-123", "displayName", "User", "roles", List.of("PARTICIPANT")))))
                .andReturn().getResponse().getStatus();
    }
    private AuthDtos.UserSummary user() { return identity.register(new AuthDtos.RegisterRequest(email(), "long-password-123", "Test", List.of("PARTICIPANT"))); }
    private String email() { return UUID.randomUUID() + "@example.com"; }
    private <T> List<T> race(Callable<T> first, Callable<T> second) throws Exception {
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var a = executor.submit(() -> { gate.await(); return first.call(); });
            var b = executor.submit(() -> { gate.await(); return second.call(); });
            gate.countDown();
            return List.of(a.get(), b.get());
        }
    }
}
