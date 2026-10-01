package com.learnova.question;

import com.learnova.TestcontainersConfiguration;
import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.security.AccessTokens;
import com.learnova.identity.service.IdentityService;
import com.learnova.question.dto.QuestionDtos.*;
import com.learnova.question.enums.*;
import com.learnova.question.exception.QuestionFailure;
import com.learnova.question.service.QuestionService;
import com.learnova.shared.api.PageQuery;
import java.util.*;
import java.util.concurrent.*;
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

@SpringBootTest @AutoConfigureMockMvc @Import(TestcontainersConfiguration.class)
class QuestionIntegrationTests {
    @Autowired QuestionService service;
    @Autowired IdentityService identity;
    @Autowired AccessTokens tokens;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @Autowired DataSource dataSource;

    @Test void roundTripsAllFourTypesAndNumericPrecision() throws Exception {
        var owner = user("CREATOR");
        for (var type : QuestionType.values()) {
            var input = valid(type, QuestionStatus.ACTIVE, null);
            var response = mvc.perform(post("/api/v1/questions").with(as(owner)).contentType("application/json").content(mapper.writeValueAsString(input)))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("ACTIVE")).andReturn().getResponse();
            UUID id = UUID.fromString(mapper.readTree(response.getContentAsString()).get("id").asText());
            var detail = service.detail(owner.id(), id);
            assertThat(detail.type()).isEqualTo(type);
            assertThat(detail.tags()).containsExactly("algebra", "math");
            if (type == QuestionType.NUMERIC_ANSWER) {
                assertThat(detail.correctValue()).isEqualTo("12345678901234567890.1234567891");
                assertThat(detail.tolerance()).isEqualTo("0");
            }
        }
    }
    @Test void draftArchiveRestoreAndActivationPreserveIdentity() {
        var owner = user("CREATOR");
        var draft = service.create(owner.id(), new WriteQuestion(QuestionType.NUMERIC_ANSWER, QuestionStatus.DRAFT, "", null, null, null, null, null, null, null, null, null));
        var persistedCreatedAt = service.detail(owner.id(), draft.id()).createdAt();
        var archived = service.archive(owner.id(), draft.id(), draft.revision());
        assertThatThrownBy(() -> service.update(owner.id(), draft.id(), valid(QuestionType.NUMERIC_ANSWER, QuestionStatus.ACTIVE, archived.revision())))
                .isInstanceOfSatisfying(QuestionFailure.class, e -> assertThat(e.code).isEqualTo("QUESTION_STATE_CONFLICT"));
        var restored = service.restore(owner.id(), draft.id(), archived.revision());
        assertThat(restored.status()).isEqualTo(QuestionStatus.DRAFT);
        var active = service.update(owner.id(), draft.id(), valid(QuestionType.NUMERIC_ANSWER, QuestionStatus.ACTIVE, restored.revision()));
        var archivedAgain = service.archive(owner.id(), active.id(), active.revision());
        assertThat(service.restore(owner.id(), active.id(), archivedAgain.revision()).status()).isEqualTo(QuestionStatus.ACTIVE);
        assertThat(service.detail(owner.id(), draft.id()).createdAt()).isEqualTo(persistedCreatedAt);
        assertThatThrownBy(() -> service.update(owner.id(), draft.id(), valid(QuestionType.NUMERIC_ANSWER, QuestionStatus.DRAFT, archivedAgain.revision() + 1)))
                .isInstanceOfSatisfying(QuestionFailure.class, e -> assertThat(e.code).isEqualTo("QUESTION_STATE_CONFLICT"));
    }
    @Test void rejectsInvalidActiveAnswersAndMalformedDrafts() throws Exception {
        var owner = user("CREATOR");
        for (String payload : List.of(
                "{\"type\":\"SINGLE_CHOICE\",\"status\":\"ACTIVE\",\"content\":\"Q\",\"options\":[{\"content\":\"a\",\"correct\":true},{\"content\":\"b\",\"correct\":true}]}",
                "{\"type\":\"MULTIPLE_CHOICE\",\"status\":\"ACTIVE\",\"content\":\"Q\",\"options\":[{\"content\":\"a\",\"correct\":false},{\"content\":\"b\",\"correct\":false}]}",
                "{\"type\":\"TRUE_FALSE\",\"status\":\"ACTIVE\",\"content\":\"Q\"}",
                "{\"type\":\"NUMERIC_ANSWER\",\"status\":\"ACTIVE\",\"content\":\"Q\"}",
                "{\"type\":\"NUMERIC_ANSWER\",\"status\":\"DRAFT\",\"tolerance\":\"-0.1\"}",
                "{\"type\":\"NUMERIC_ANSWER\",\"status\":\"DRAFT\",\"correctValue\":\"0.12345678901\"}",
                "{\"type\":\"NUMERIC_ANSWER\",\"status\":\"DRAFT\",\"correctValue\":\"100000000000000000000\"}",
                "{\"type\":\"NUMERIC_ANSWER\",\"status\":\"DRAFT\",\"correctValue\":\"NaN\"}",
                "{\"type\":\"TRUE_FALSE\",\"status\":\"DRAFT\",\"options\":[null]}",
                "{\"type\":\"TRUE_FALSE\",\"status\":\"DRAFT\",\"tags\":[null]}",
                "{\"type\":\"TRUE_FALSE\",\"status\":\"DRAFT\",\"ownerId\":\"spoof\"}")) {
            mvc.perform(post("/api/v1/questions").with(as(owner)).contentType("application/json").content(payload)).andExpect(status().isBadRequest());
        }
        var multi = valid(QuestionType.MULTIPLE_CHOICE, QuestionStatus.ACTIVE, null);
        assertThat(service.create(owner.id(), multi).options()).hasSize(2);
    }
    @Test void everyEndpointEnforcesOwnershipAndCurrentRole() throws Exception {
        var owner = user("CREATOR"); var other = user("CREATOR"); var participant = user("PARTICIPANT");
        var q = service.create(owner.id(), valid(QuestionType.TRUE_FALSE, QuestionStatus.ACTIVE, null));
        String path = "/api/v1/questions/" + q.id();
        for (var request : List.of(get(path), put(path).contentType("application/json").content(mapper.writeValueAsString(valid(QuestionType.TRUE_FALSE, QuestionStatus.ACTIVE, q.revision()))),
                post(path + "/archive").contentType("application/json").content("{\"revision\":1}"), post(path + "/restore").contentType("application/json").content("{\"revision\":1}")))
            mvc.perform(request.with(as(other))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/questions").with(as(participant))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/questions").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
        var token = as(owner);
        jdbc.update("update user_roles set role='ADMIN' where user_id=?", owner.id());
        mvc.perform(get(path).with(token)).andExpect(status().isForbidden());
        jdbc.update("update user_roles set role='CREATOR' where user_id=?", owner.id());
        jdbc.update("update users set status='LOCKED' where id=?", owner.id());
        mvc.perform(get(path).with(token)).andExpect(status().isForbidden());
    }
    @Test void filtersPagesAndDoesNotExposeAnswersInList() throws Exception {
        var owner = user("CREATOR"); var other = user("CREATOR");
        for (int i = 0; i < 3; i++) service.create(owner.id(), valid(QuestionType.SINGLE_CHOICE, QuestionStatus.ACTIVE, null));
        service.create(other.id(), valid(QuestionType.SINGLE_CHOICE, QuestionStatus.ACTIVE, null));
        var found = service.list(owner.id(), "question", QuestionType.SINGLE_CHOICE, Difficulty.EASY, "math", "MATH", null, new PageQuery(0, 2));
        assertThat(found.totalElements()).isEqualTo(3); assertThat(found.content()).hasSize(2);
        var q = found.content().getFirst(); service.archive(owner.id(), q.id(), q.revision());
        assertThat(service.list(owner.id(), "", null, null, null, null, null, new PageQuery(0, 20)).totalElements()).isEqualTo(2);
        assertThat(service.list(owner.id(), "", null, null, null, null, QuestionStatus.ARCHIVED, new PageQuery(0, 20)).totalElements()).isEqualTo(1);
        assertThat(service.list(owner.id(), "%", null, null, null, null, null, new PageQuery(0, 20)).totalElements()).isZero();
        mvc.perform(get("/api/v1/questions").with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].options").doesNotExist()).andExpect(jsonPath("$.content[0].correctValue").doesNotExist());
        for (String query : List.of("?page=-1", "?size=101", "?type=ESSAY", "?status=UNKNOWN")) mvc.perform(get("/api/v1/questions" + query).with(as(owner))).andExpect(status().isBadRequest());
    }
    @Test void concurrentEditAndArchiveCannotOverwriteAndAuditRollsBack() throws Exception {
        var owner = user("CREATOR"); var q = service.create(owner.id(), valid(QuestionType.TRUE_FALSE, QuestionStatus.ACTIVE, null));
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var a = executor.submit(() -> { gate.await(); return attempt(() -> service.update(owner.id(), q.id(), valid(QuestionType.TRUE_FALSE, QuestionStatus.ACTIVE, q.revision()))); });
            var b = executor.submit(() -> { gate.await(); return attempt(() -> service.archive(owner.id(), q.id(), q.revision())); });
            gate.countDown(); assertThat(List.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS))).containsExactlyInAnyOrder("OK", "QUESTION_REVISION_CONFLICT");
        }
        long before = jdbc.queryForObject("select count(*) from questions where owner_id=?", Long.class, owner.id());
        long audits = jdbc.queryForObject("select count(*) from audit_records where actor_user_id=?", Long.class, owner.id().toString());
        new TransactionTemplate(manager).executeWithoutResult(tx -> { service.create(owner.id(), valid(QuestionType.TRUE_FALSE, QuestionStatus.DRAFT, null)); tx.setRollbackOnly(); });
        assertThat(jdbc.queryForObject("select count(*) from questions where owner_id=?", Long.class, owner.id())).isEqualTo(before);
        assertThat(jdbc.queryForObject("select count(*) from audit_records where actor_user_id=?", Long.class, owner.id().toString())).isEqualTo(audits);
    }
    @Test void migrationFromV5PreservesUsersAndClasses() {
        String schema = "question_" + UUID.randomUUID().toString().replace("-", "");
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("5").load().migrate();
        var id = UUID.randomUUID(); var classroom = UUID.randomUUID();
        jdbc.update("insert into " + schema + ".users (id,email,display_name,status,created_at,onboarding_completed) values (?,?,'Existing','ACTIVE',now(),true)", id, id + "@example.com");
        jdbc.update("insert into " + schema + ".classrooms values (?,?,'Existing class',null,now(),now())", classroom, id);
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
        assertThat(jdbc.queryForObject("select name from " + schema + ".classrooms where id=?", String.class, classroom)).isEqualTo("Existing class");
    }
    private String attempt(Runnable task) { try { task.run(); return "OK"; } catch (QuestionFailure ex) { return ex.code; } }
    private WriteQuestion valid(QuestionType type, QuestionStatus status, Long revision) {
        boolean choice = type == QuestionType.SINGLE_CHOICE || type == QuestionType.MULTIPLE_CHOICE;
        return new WriteQuestion(type, status, "Question", "Explanation", Difficulty.EASY, "Math", List.of("math", "algebra", "math"),
                choice ? List.of(new Option("A", true), new Option("B", type == QuestionType.MULTIPLE_CHOICE)) : List.of(),
                type == QuestionType.TRUE_FALSE ? false : null, type == QuestionType.NUMERIC_ANSWER ? "12345678901234567890.1234567891" : null, null, revision);
    }
    private AuthDtos.UserSummary user(String role) { return identity.register(new AuthDtos.RegisterRequest(UUID.randomUUID() + "@example.com", "Test password 123", "Test", List.of(role))); }
    private RequestPostProcessor as(AuthDtos.UserSummary user) {
        String token = tokens.issue(user, UUID.randomUUID().toString()).accessToken();
        return request -> { request.addHeader("Authorization", "Bearer " + token); return request; };
    }
}
