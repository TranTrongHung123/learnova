package com.learnova.classroom;

import com.learnova.TestcontainersConfiguration;
import com.learnova.classroom.dto.ClassroomDtos.*;
import com.learnova.classroom.entity.ClassroomJoinCode;
import com.learnova.classroom.enums.MembershipStatus;
import com.learnova.classroom.exception.ClassroomFailure;
import com.learnova.classroom.service.ClassroomService;
import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.security.AccessTokens;
import com.learnova.identity.service.IdentityService;
import com.learnova.shared.api.PageQuery;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
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
class ClassroomIntegrationTests {
    @Autowired ClassroomService service;
    @Autowired IdentityService identity;
    @Autowired AccessTokens tokens;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @Autowired DataSource dataSource;
    private static final PageQuery PAGE = new PageQuery(0, 20);

    @Test void createsUpdatesAndListsOnlyOwnedClasses() throws Exception {
        var owner = user("CREATOR"); var other = user("CREATOR");
        var response = mvc.perform(post("/api/v1/classrooms").with(as(owner)).contentType("application/json")
                .content("{\"name\":\"  Lớp Toán  \" ,\"description\":\" Mô tả \"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Lớp Toán"))
                .andExpect(jsonPath("$.joinCode.status").value("NOT_CREATED")).andReturn().getResponse();
        var id = UUID.fromString(mapper.readTree(response.getContentAsString()).get("id").asText());
        assertThat(service.owned(other.id(), "", PAGE).totalElements()).isZero();
        assertThat(service.owned(owner.id(), "toán", PAGE).totalElements()).isEqualTo(1);
        mvc.perform(put(path(id)).with(as(owner)).contentType("application/json").content("{\"name\":\"Updated\",\"description\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.description").isEmpty());
        mvc.perform(get(path(id)).with(as(other))).andExpect(status().isNotFound());
        assertThat(service.detail(owner.id(), id).name()).isEqualTo("Updated");
        assertThat(audits(id, "CLASSROOM_UPDATED")).isEqualTo(1);
    }

    @Test void rejectsInvalidInputMassAssignmentAndPagination() throws Exception {
        var owner = user("CREATOR"); var c = classroom(owner);
        for (String json : List.of("{\"name\":\" \"}", "{\"name\":\"OK\",\"ownerId\":\"bad\"}", "{\"name\":\"" + "a".repeat(201) + "\"}",
                "{\"name\":\"OK\",\"description\":\"" + "d".repeat(2001) + "\"}"))
            mvc.perform(post("/api/v1/classrooms").with(as(owner)).contentType("application/json").content(json)).andExpect(status().isBadRequest());
        for (String query : List.of("?page=-1", "?size=101", "?page=abc", "?size=0", "?page=0&page=1"))
            mvc.perform(get("/api/v1/classrooms" + query).with(as(owner))).andExpect(status().isBadRequest());
        mvc.perform(get(path(c.id()) + "/members?status=UNKNOWN").with(as(owner))).andExpect(status().isBadRequest());
        mvc.perform(post(path(c.id()) + "/members").with(as(owner)).contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors[0].field").value("userId"));
    }

    @Test void enforcesCurrentRoleAccountAndOnboardingAndNeverAuthenticatesByCookie() throws Exception {
        var owner = user("CREATOR"); var participant = user("PARTICIPANT"); var c = classroom(owner);
        mvc.perform(post("/api/v1/classrooms").cookie(new Cookie("learnova_refresh", "not-a-bearer"))
                .contentType("application/json").content("{\"name\":\"Test\"}")).andExpect(status().isUnauthorized());
        mvc.perform(get(path(c.id())).with(as(participant))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/classrooms/joined").with(as(owner))).andExpect(status().isForbidden());
        var staleToken = as(owner);
        jdbc.update("update user_roles set role='ADMIN' where user_id=?", owner.id());
        mvc.perform(get(path(c.id())).with(staleToken)).andExpect(status().isForbidden());
        jdbc.update("update user_roles set role='CREATOR' where user_id=?", owner.id());
        for (String state : List.of("LOCKED", "DISABLED")) {
            jdbc.update("update users set status=? where id=?", state, owner.id());
            mvc.perform(get(path(c.id())).with(staleToken)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_" + state));
        }
        jdbc.update("update users set status='ACTIVE',onboarding_completed=false where id=?", owner.id());
        mvc.perform(get(path(c.id())).with(staleToken)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ONBOARDING_REQUIRED"));
        mvc.perform(put("/api/v1/auth/profile").with(as(participant)).contentType("application/json").content("{\"displayName\":\"Test\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test void allOwnerOperationsRejectOtherCreators() throws Exception {
        var owner = user("CREATOR"); var other = user("CREATOR"); var p = user("PARTICIPANT"); var c = classroom(owner);
        var id = c.id();
        for (var request : List.of(get(path(id)), put(path(id)).contentType("application/json").content("{\"name\":\"Hacked\"}"),
                get(path(id) + "/members"), get(path(id) + "/participants/lookup").param("email", p.email()),
                post(path(id) + "/members").contentType("application/json").content("{\"userId\":\"" + p.id() + "\"}"),
                delete(path(id) + "/members/" + p.id()), post(path(id) + "/join-code"), delete(path(id) + "/join-code")))
            mvc.perform(request.with(as(other))).andExpect(status().isNotFound());
        assertThat(service.detail(owner.id(), id).name()).isEqualTo("Classroom");
    }

    @Test void exactLookupNormalizesEmailAndAdditionRevalidatesParticipant() throws Exception {
        var owner = user("CREATOR"); var p = user("PARTICIPANT"); var c = classroom(owner);
        mvc.perform(get(path(c.id()) + "/participants/lookup").param("email", " " + p.email().toUpperCase() + " ").with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(p.id().toString())).andExpect(jsonPath("$.roles").doesNotExist());
        mvc.perform(get(path(c.id()) + "/participants/lookup").param("email", "missing@example.com").with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(get(path(c.id()) + "/participants/lookup").param("email", "partial").with(as(owner))).andExpect(status().isBadRequest());
        assertThatThrownBy(() -> service.add(owner.id(), c.id(), owner.id())).isInstanceOf(ClassroomFailure.class);
        jdbc.update("update users set status='LOCKED' where id=?", p.id());
        assertThatThrownBy(() -> service.add(owner.id(), c.id(), p.id())).isInstanceOf(ClassroomFailure.class);
        jdbc.update("update users set status='ACTIVE',onboarding_completed=false where id=?", p.id());
        assertThatThrownBy(() -> service.add(owner.id(), c.id(), p.id())).isInstanceOf(ClassroomFailure.class);
        assertThat(service.members(owner.id(), c.id(), "", null, PAGE).totalElements()).isZero();
    }

    @Test void addRemoveLeaveAndRejoinPreserveMembershipAndAuditOnlyTransitions() {
        var owner = user("CREATOR"); var p = user("PARTICIPANT"); var c = classroom(owner);
        var original = service.add(owner.id(), c.id(), p.id());
        assertThat(service.add(owner.id(), c.id(), p.id())).isEqualTo(original);
        service.remove(owner.id(), c.id(), p.id()); service.remove(owner.id(), c.id(), p.id());
        assertThat(service.joined(p.id(), PAGE).totalElements()).isZero();
        var code = service.regenerate(owner.id(), c.id());
        assertThat(service.preview(p.id(), code.code()).membershipStatus()).isEqualTo(MembershipStatus.REMOVED);
        var again = service.join(p.id(), code.code());
        assertThat(again.id()).isEqualTo(original.id()); assertThat(again.joinedAt()).isEqualTo(original.joinedAt());
        assertThat(service.join(p.id(), code.code())).isEqualTo(again);
        service.leave(p.id(), c.id()); service.leave(p.id(), c.id());
        assertThat(service.add(owner.id(), c.id(), p.id()).id()).isEqualTo(original.id());
        assertThat(count(c.id())).isEqualTo(1);
        assertThat(audits(c.id(), "CLASSROOM_MEMBER_ADDED")).isEqualTo(2);
        assertThat(audits(c.id(), "CLASSROOM_JOINED")).isEqualTo(1);
        assertThat(audits(c.id(), "CLASSROOM_MEMBER_REMOVED")).isEqualTo(1);
        assertThat(audits(c.id(), "CLASSROOM_LEFT")).isEqualTo(1);
        assertThat(service.detail(owner.id(), c.id()).activeParticipants()).isEqualTo(1);
    }

    @Test void previewsAndParticipantListsExposeOnlyPermittedFields() throws Exception {
        var owner = user("CREATOR"); var p = user("PARTICIPANT"); var c = classroom(owner); var code = service.regenerate(owner.id(), c.id());
        var json = mapper.writeValueAsString(Map.of("code", code.code().toLowerCase()));
        mvc.perform(post("/api/v1/classrooms/join-preview").with(as(p)).contentType("application/json").content(json))
                .andExpect(status().isOk()).andExpect(jsonPath("$.membershipStatus").isEmpty())
                .andExpect(jsonPath("$.creatorName").value("Test")).andExpect(jsonPath("$.email").doesNotExist())
                .andExpect(jsonPath("$.members").doesNotExist()).andExpect(jsonPath("$.code").doesNotExist());
        assertThat(count(c.id())).isZero();
        mvc.perform(post("/api/v1/classrooms/join").with(as(p)).contentType("application/json").content(json)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/classrooms/joined").with(as(p))).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(c.id().toString())).andExpect(jsonPath("$.content[0].joinCode").doesNotExist());
        mvc.perform(get("/api/v1/classrooms").with(as(owner))).andExpect(jsonPath("$.content[0].joinCodeStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.content[0].code").doesNotExist());
    }

    @Test void codesExpireRegenerateRevokeAndRevalidateAfterPreview() {
        var owner = user("CREATOR"); var p = user("PARTICIPANT"); var c = classroom(owner);
        service.revoke(owner.id(), c.id());
        var first = service.regenerate(owner.id(), c.id());
        assertThat(first.code()).matches("[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}");
        assertThat(Duration.between(Instant.now(), first.expiresAt()).toSeconds()).isBetween(604790L, 604800L);
        service.preview(p.id(), first.code());
        var second = service.regenerate(owner.id(), c.id());
        assertInvalid(p, first.code());
        service.revoke(owner.id(), c.id()); service.revoke(owner.id(), c.id());
        assertInvalid(p, second.code());
        assertThat(service.detail(owner.id(), c.id()).joinCode().code()).isNull();
        var third = service.regenerate(owner.id(), c.id());
        jdbc.update("update classroom_join_codes set created_at=now()-interval '8 days',expires_at=now()-interval '1 second' where classroom_id=?", c.id());
        assertInvalid(p, third.code());
        assertThat(service.detail(owner.id(), c.id()).joinCode().status()).isEqualTo("EXPIRED");
        assertInvalid(p, "UNKNOWN");
        assertThat(audits(c.id(), "CLASSROOM_JOIN_CODE_REVOKED")).isEqualTo(1);
        String metadata = jdbc.queryForObject("select string_agg(metadata::text, ',') from audit_records where target_id=?", String.class, c.id().toString());
        assertThat(metadata).doesNotContain(first.code(), second.code(), third.code());
    }

    @Test void expiryBoundaryUsesExclusiveExpiresAt() {
        Instant now = Instant.parse("2026-09-29T00:00:00Z");
        var code = new ClassroomJoinCode(UUID.randomUUID(), "ABCDEFGH23456789", now);
        assertThat(code.validAt(now.plus(Duration.ofDays(7)).minusNanos(1))).isTrue();
        assertThat(code.validAt(now.plus(Duration.ofDays(7)))).isFalse();
        code.revoke(now.plusSeconds(1)); assertThat(code.validAt(now.plusSeconds(2))).isFalse();
    }

    @Test void searchesAndPaginatesMembersWithoutWildcardExpansion() {
        var owner = user("CREATOR"); var a = user("PARTICIPANT"); var b = user("PARTICIPANT"); var c = classroom(owner);
        service.add(owner.id(), c.id(), a.id()); service.add(owner.id(), c.id(), b.id()); service.remove(owner.id(), c.id(), b.id());
        assertThat(service.members(owner.id(), c.id(), "", null, new PageQuery(0, 1)).totalPages()).isEqualTo(2);
        assertThat(service.members(owner.id(), c.id(), a.email(), MembershipStatus.ACTIVE, PAGE).content()).hasSize(1);
        assertThat(service.members(owner.id(), c.id(), "", MembershipStatus.REMOVED, PAGE).content()).hasSize(1);
        assertThat(service.members(owner.id(), c.id(), "%", null, PAGE).content()).isEmpty();
        assertThat(service.members(owner.id(), c.id(), "", null, new PageQuery(Integer.MAX_VALUE, 100)).content()).isEmpty();
    }

    @Test void concurrentJoinAndDirectAddCreateOneMembership() throws Exception {
        var owner = user("CREATOR"); var p = user("PARTICIPANT"); var c = classroom(owner); var code = service.regenerate(owner.id(), c.id());
        var results = race(() -> service.join(p.id(), code.code()), () -> service.join(p.id(), code.code()));
        assertThat(results.get(0).id()).isEqualTo(results.get(1).id()); assertThat(count(c.id())).isEqualTo(1);
        assertThat(audits(c.id(), "CLASSROOM_JOINED")).isEqualTo(1);
        service.leave(p.id(), c.id());
        results = race(() -> service.join(p.id(), code.code()), () -> service.add(owner.id(), c.id(), p.id()));
        assertThat(results.get(0).id()).isEqualTo(results.get(1).id()); assertThat(count(c.id())).isEqualTo(1);
    }

    @Test void joinsRacingWithRevokeOrRegenerateHaveSerializableOutcomes() throws Exception {
        var owner = user("CREATOR"); var p = user("PARTICIPANT"); var c = classroom(owner);
        for (boolean revoke : List.of(true, false)) {
            var code = service.regenerate(owner.id(), c.id());
            race(() -> { try { service.join(p.id(), code.code()); return "JOINED"; } catch (ClassroomFailure ex) { return ex.code; } },
                    () -> { if (revoke) service.revoke(owner.id(), c.id()); else service.regenerate(owner.id(), c.id()); return "CHANGED"; });
            assertInvalid(p, code.code()); assertThat(count(c.id())).isLessThanOrEqualTo(1);
        }
    }

    @Test void stateAndAuditRollbackTogether() {
        var owner = user("CREATOR"); var p = user("PARTICIPANT"); var c = classroom(owner);
        new TransactionTemplate(manager).executeWithoutResult(tx -> { service.add(owner.id(), c.id(), p.id()); tx.setRollbackOnly(); });
        assertThat(count(c.id())).isZero(); assertThat(audits(c.id(), "CLASSROOM_MEMBER_ADDED")).isZero();
        new TransactionTemplate(manager).executeWithoutResult(tx -> { service.regenerate(owner.id(), c.id()); tx.setRollbackOnly(); });
        assertThat(service.detail(owner.id(), c.id()).joinCode().status()).isEqualTo("NOT_CREATED");
        assertThat(audits(c.id(), "CLASSROOM_JOIN_CODE_GENERATED")).isZero();
    }

    @Test void joinWaitingOnClassroomLockRechecksTheChangedCode() throws Exception {
        var owner = user("CREATOR"); var p = user("PARTICIPANT"); var c = classroom(owner);
        for (boolean revoke : List.of(true, false)) {
            var code = service.regenerate(owner.id(), c.id());
            try (var executor = Executors.newSingleThreadExecutor()) {
                var result = new java.util.concurrent.atomic.AtomicReference<java.util.concurrent.Future<String>>();
                new TransactionTemplate(manager).executeWithoutResult(tx -> {
                    jdbc.queryForObject("select id from classrooms where id=? for update", UUID.class, c.id());
                    result.set(executor.submit(() -> {
                        try { service.join(p.id(), code.code()); return "JOINED"; }
                        catch (ClassroomFailure failure) { return failure.code; }
                    }));
                    long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(5);
                    boolean waiting = false;
                    while (System.nanoTime() < deadline) {
                        waiting = jdbc.queryForObject("select exists(select 1 from pg_locks where not granted and locktype='transactionid')", Boolean.class);
                        if (waiting) break;
                        try { Thread.sleep(10); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new IllegalStateException(ex); }
                    }
                    assertThat(waiting).as("join must be waiting on the held classroom lock").isTrue();
                    if (revoke) service.revoke(owner.id(), c.id()); else service.regenerate(owner.id(), c.id());
                });
                assertThat(result.get().get(10, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo("JOIN_CODE_INVALID");
                assertThat(count(c.id())).isZero();
            }
        }
    }

    @Test void databaseConstraintsAndMigrationFromV4PreserveExistingUsers() {
        String schema = "classroom_" + UUID.randomUUID().toString().replace("-", "");
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("4").load().migrate();
        var id = UUID.randomUUID();
        jdbc.update("insert into " + schema + ".users (id,email,display_name,status,created_at,onboarding_completed) values (?,?,'Existing','ACTIVE',now(),true)", id, id + "@example.com");
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
        assertThat(jdbc.queryForObject("select display_name from " + schema + ".users where id=?", String.class, id)).isEqualTo("Existing");
        var owner = user("CREATOR"); var p = user("PARTICIPANT"); var c = classroom(owner); service.add(owner.id(), c.id(), p.id());
        assertThatThrownBy(() -> jdbc.update("insert into classroom_memberships values (?,?,?,'ACTIVE',now(),now())", UUID.randomUUID(), c.id(), p.id())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update classroom_memberships set status='UNKNOWN' where classroom_id=?", c.id())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("delete from classrooms where id=?", c.id())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    private AuthDtos.UserSummary user(String role) { return identity.register(new AuthDtos.RegisterRequest(UUID.randomUUID() + "@example.com", "Test password 123", "Test", List.of(role))); }
    private OwnerDetail classroom(AuthDtos.UserSummary owner) { return service.create(owner.id(), new WriteClassroom("Classroom", null)); }
    private String path(UUID id) { return "/api/v1/classrooms/" + id; }
    private RequestPostProcessor as(AuthDtos.UserSummary user) {
        String token = tokens.issue(user, UUID.randomUUID().toString()).accessToken();
        return request -> { request.addHeader("Authorization", "Bearer " + token); return request; };
    }
    private long count(UUID id) { return jdbc.queryForObject("select count(*) from classroom_memberships where classroom_id=?", Long.class, id); }
    private long audits(UUID id, String action) { return jdbc.queryForObject("select count(*) from audit_records where target_id=? and action=?", Long.class, id.toString(), action); }
    private void assertInvalid(AuthDtos.UserSummary p, String code) {
        assertThatThrownBy(() -> service.join(p.id(), code)).isInstanceOfSatisfying(ClassroomFailure.class, ex -> assertThat(ex.code).isEqualTo("JOIN_CODE_INVALID"));
    }
    private <T> List<T> race(Callable<T> first, Callable<T> second) throws Exception {
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var a = executor.submit(() -> { gate.await(); return first.call(); }); var b = executor.submit(() -> { gate.await(); return second.call(); });
            gate.countDown(); return List.of(a.get(15, java.util.concurrent.TimeUnit.SECONDS), b.get(15, java.util.concurrent.TimeUnit.SECONDS));
        }
    }
}
