package com.learnova.exam;

import com.learnova.TestcontainersConfiguration;
import com.learnova.exam.dto.ExamDtos.*;
import com.learnova.exam.enums.*;
import com.learnova.exam.exception.ExamFailure;
import com.learnova.exam.service.ExamService;
import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.security.AccessTokens;
import com.learnova.identity.service.IdentityService;
import com.learnova.question.dto.QuestionDtos;
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
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @Import(TestcontainersConfiguration.class)
class ExamIntegrationTests {
    @Autowired ExamService service;
    @Autowired QuestionService questions;
    @Autowired IdentityService identity;
    @Autowired AccessTokens tokens;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;

    @Test void snapshotsRoundTripFourTypesAndSurviveBankChangesCopiesAndArchive() {
        var owner = user("CREATOR");
        var exam = service.create(owner.id(), new CreateExam("Midterm", "Description"));
        var version = service.version(owner.id(), exam.versions().getFirst().id());
        var sources = new ArrayList<QuestionDtos.Detail>();
        for (var type : QuestionType.values()) sources.add(questions.create(owner.id(), input(type, null, "Original " + type)));
        version = service.add(owner.id(), version.id(), new AddQuestions(version.revision(), sources.stream().map(q -> new Source(q.id(), q.revision())).toList()));
        var snapshot = version.questions();
        for (var q : sources) {
            var changed = questions.update(owner.id(), q.id(), input(q.type(), q.revision(), "Changed"));
            questions.archive(owner.id(), q.id(), changed.revision());
        }
        assertThat(service.version(owner.id(), version.id()).questions()).isEqualTo(snapshot);
        version = service.publish(owner.id(), version.id(), version.revision());
        assertThat(version.status()).isEqualTo(VersionStatus.PUBLISHED);
        assertThat(version.questions()).isEqualTo(snapshot);
        assertThat(version.totalScore()).isEqualTo("4");
        var numeric = version.questions().stream().filter(q -> q.snapshot().type() == QuestionType.NUMERIC_ANSWER).findFirst().orElseThrow();
        assertThat(numeric.snapshot().correctValue()).isEqualTo("12345678901234567890.1234567891");
        var copy = service.createVersion(owner.id(), exam.id(), new NewVersion(version.id()));
        assertThat(copy.versionNumber()).isEqualTo(2);
        assertThat(copy.status()).isEqualTo(VersionStatus.DRAFT);
        assertThat(copy.questions().getFirst().id()).isNotEqualTo(snapshot.getFirst().id());
        assertThat(copy.questions().getFirst().snapshot().options().getFirst().id()).isNotEqualTo(snapshot.getFirst().snapshot().options().getFirst().id());
        assertThat(copy.questions().getFirst().snapshot().content()).isEqualTo(snapshot.getFirst().snapshot().content());
        var current = service.detail(owner.id(), exam.id());
        service.archive(owner.id(), exam.id(), current.revision());
        assertThat(service.detail(owner.id(), exam.id()).versions()).hasSize(2);
        assertThat(service.publish(owner.id(), copy.id(), copy.revision()).status()).isEqualTo(VersionStatus.PUBLISHED);
        assertThat(service.createVersion(owner.id(), exam.id(), new NewVersion(null)).versionNumber()).isEqualTo(3);
        assertThat(service.list(owner.id(), "", ExamStatus.ACTIVE, new PageQuery(0, 20)).totalElements()).isZero();
        assertThat(service.list(owner.id(), "mid", ExamStatus.ARCHIVED, new PageQuery(0, 20)).totalElements()).isEqualTo(1);
    }
    @Test void reorderRemovePrecisionAndRevisionAreAtomic() {
        var owner = user("CREATOR"); var v = populated(owner);
        var other = questions.create(owner.id(), input(QuestionType.TRUE_FALSE, null, "Other"));
        v = service.add(owner.id(), v.id(), new AddQuestions(v.revision(), List.of(new Source(other.id(), other.revision()))));
        var before = v;
        for (String invalid : List.of("0", "-1", "1e2", "NaN", "0.00000000001", "100000000000000000000")) {
            assertThatThrownBy(() -> service.save(owner.id(), before.id(), new SaveQuestions(before.revision(), List.of(new QuestionEdit(before.questions().getFirst().id(), invalid)))))
                    .isInstanceOf(ExamFailure.class);
        }
        assertThat(service.version(owner.id(), v.id()).questions()).isEqualTo(v.questions());
        var saved = service.save(owner.id(), v.id(), new SaveQuestions(v.revision(), List.of(
                new QuestionEdit(v.questions().get(1).id(), "0.1234567891"), new QuestionEdit(v.questions().getFirst().id(), "99999999999999999999.1234567891"))));
        assertThat(saved.totalScore()).isEqualTo("99999999999999999999.2469135782");
        assertThat(service.version(owner.id(), v.id()).questions().getFirst().sourceQuestionId()).isEqualTo(other.id());
        assertCode(() -> service.save(owner.id(), before.id(), new SaveQuestions(before.revision(), List.of())), "EXAM_REVISION_CONFLICT");
        saved = service.save(owner.id(), saved.id(), new SaveQuestions(saved.revision(), List.of(new QuestionEdit(saved.questions().getFirst().id(), "0.25"))));
        assertThat(saved.totalScore()).isEqualTo("0.25");
        var empty = service.save(owner.id(), saved.id(), new SaveQuestions(saved.revision(), List.of()));
        assertCode(() -> service.publish(owner.id(), empty.id(), empty.revision()), "EXAM_EMPTY_VERSION");
    }
    @Test void ownershipValidationAndAllPublishedMutationPathsAreEnforcedOverHttp() throws Exception {
        var owner = user("CREATOR"); var other = user("CREATOR"); var participant = user("PARTICIPANT"); var v = populated(owner);
        mvc.perform(get("/api/v1/exam-versions/" + v.id())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/exam-versions/" + v.id()).with(as(other))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/exams").with(as(participant))).andExpect(status().isForbidden());
        var admin = user("PARTICIPANT");
        jdbc.update("delete from user_roles where user_id=?", admin.id());
        jdbc.update("insert into user_roles(user_id,role) values (?,'ADMIN')", admin.id());
        mvc.perform(get("/api/v1/exams").with(as(admin))).andExpect(status().isForbidden());
        for (String body : List.of("{\"name\":\" \"}", "{\"name\":\"Valid\",\"ownerId\":\"" + other.id() + "\"}"))
            mvc.perform(post("/api/v1/exams").with(as(owner)).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/exam-versions/" + v.id() + "/questions").with(as(owner)).contentType("application/json")
                .content("{\"revision\":1,\"questions\":[null]}" )).andExpect(status().isBadRequest());
        var published = service.publish(owner.id(), v.id(), v.revision());
        for (var request : List.of(
                put("/api/v1/exam-versions/" + v.id() + "/questions").content(mapper.writeValueAsString(new SaveQuestions(published.revision(), List.of()))),
                post("/api/v1/exam-versions/" + v.id() + "/questions").content(mapper.writeValueAsString(new AddQuestions(published.revision(), List.of(new Source(v.questions().getFirst().sourceQuestionId(), 1L))))))) {
            mvc.perform(request.with(as(owner)).contentType("application/json")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXAM_VERSION_IMMUTABLE"));
        }
        mvc.perform(post("/api/v1/exam-versions/" + v.id() + "/publish").with(as(other)).contentType("application/json").content("{\"revision\":1}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/exams?size=101").with(as(owner))).andExpect(status().isBadRequest());
    }
    @Test void sourcesMustBeActiveOwnedDistinctAndMatchSelectedRevision() {
        var owner = user("CREATOR"); var v = populated(owner); var other = user("CREATOR");
        var foreign = questions.create(other.id(), input(QuestionType.TRUE_FALSE, null, "Foreign"));
        assertThatThrownBy(() -> service.add(owner.id(), v.id(), new AddQuestions(v.revision(), List.of(new Source(foreign.id(), foreign.revision()))))).isInstanceOf(QuestionFailure.class);
        var source = v.questions().getFirst();
        assertCode(() -> service.add(owner.id(), v.id(), new AddQuestions(v.revision(), List.of(new Source(source.sourceQuestionId(), source.sourceRevision())))), "EXAM_DUPLICATE_QUESTION");
        var q = questions.create(owner.id(), input(QuestionType.TRUE_FALSE, null, "New"));
        questions.update(owner.id(), q.id(), input(q.type(), q.revision(), "Updated"));
        assertThatThrownBy(() -> service.add(owner.id(), v.id(), new AddQuestions(v.revision(), List.of(new Source(q.id(), q.revision()))))).isInstanceOf(QuestionFailure.class);
        questions.archive(owner.id(), q.id(), q.revision() + 1);
        assertThatThrownBy(() -> service.add(owner.id(), v.id(), new AddQuestions(v.revision(), List.of(new Source(q.id(), q.revision() + 2))))).isInstanceOf(QuestionFailure.class);
        assertCode(() -> service.createVersion(owner.id(), v.examId(), new NewVersion(v.id())), "EXAM_BASE_NOT_PUBLISHED");
        assertThat(service.version(owner.id(), v.id()).revision()).isEqualTo(v.revision());
    }
    @Test void concurrentVersionsAndPublishHaveUniqueNumbersAndSingleAudit() throws Exception {
        var owner = user("CREATOR"); var v = populated(owner);
        var results = concurrently(() -> service.publish(owner.id(), v.id(), v.revision()).status().name(), () -> service.publish(owner.id(), v.id(), v.revision()).status().name());
        assertThat(results).containsExactly("PUBLISHED", "PUBLISHED");
        assertThat(jdbc.queryForObject("select count(*) from audit_records where action='EXAM_VERSION_PUBLISHED' and target_id=?", Long.class, v.id().toString())).isEqualTo(1);
        assertThat(concurrently(() -> Integer.toString(service.createVersion(owner.id(), v.examId(), new NewVersion(v.id())).versionNumber()),
                () -> Integer.toString(service.createVersion(owner.id(), v.examId(), new NewVersion(null)).versionNumber()))).containsExactlyInAnyOrder("2", "3");
    }
    @Test void saveRacingPublishCannotModifyPublishedContent() throws Exception {
        var owner = user("CREATOR"); var v = populated(owner);
        var result = concurrently(() -> attempt(() -> service.save(owner.id(), v.id(), new SaveQuestions(v.revision(), List.of(new QuestionEdit(v.questions().getFirst().id(), "2"))))),
                () -> attempt(() -> service.publish(owner.id(), v.id(), v.revision())));
        assertThat(result.stream().filter("OK"::equals).count()).isEqualTo(1);
        var current = service.version(owner.id(), v.id());
        assertThat(current.totalScore()).isEqualTo(current.status() == VersionStatus.PUBLISHED ? "1" : "2");
        assertThat(result).anyMatch(s -> s.equals("EXAM_VERSION_IMMUTABLE") || s.equals("EXAM_REVISION_CONFLICT"));
    }
    @Test void invalidSnapshotAndFailedAuditCannotPartiallyPublish() {
        var owner = user("CREATOR"); var v = populated(owner);
        jdbc.update("update exam_version_questions set snapshot=jsonb_set(snapshot,'{content}','\"\"') where version_id=?", v.id());
        assertCode(() -> service.publish(owner.id(), v.id(), v.revision()), "EXAM_INVALID_SNAPSHOT");
        jdbc.update("update exam_version_questions set snapshot=jsonb_set(snapshot,'{content}','\"Restored\"') where version_id=?", v.id());
        String constraint = "reject_exam_" + v.id().toString().replace("-", "");
        jdbc.execute("alter table audit_records add constraint " + constraint + " check (action <> 'EXAM_VERSION_PUBLISHED' or target_id <> '" + v.id() + "') not valid");
        try {
            assertThatThrownBy(() -> service.publish(owner.id(), v.id(), v.revision())).isInstanceOf(RuntimeException.class);
            assertThat(service.version(owner.id(), v.id()).status()).isEqualTo(VersionStatus.DRAFT);
            assertThat(service.version(owner.id(), v.id()).revision()).isEqualTo(v.revision());
        } finally { jdbc.execute("alter table audit_records drop constraint " + constraint); }
    }
    @Test void migrationFromV7PreservesQuestionHistory() {
        String schema = "exam_" + UUID.randomUUID().toString().replace("-", "");
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("7").load().migrate();
        var owner = UUID.randomUUID(); var question = UUID.randomUUID();
        jdbc.update("insert into " + schema + ".users(id,email,display_name,status,created_at,onboarding_completed) values (?,?,'Owner','ACTIVE',now(),true)", owner, owner + "@example.com");
        jdbc.update("insert into " + schema + ".questions(id,owner_id,type,status,content,correct_boolean,created_at,updated_at) values (?,?,'TRUE_FALSE','ACTIVE','Old',true,now(),now())", question, owner);
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
        assertThat(jdbc.queryForObject("select content from " + schema + ".questions where id=?", String.class, question)).isEqualTo("Old");
    }
    @Test void matrixFiltersExcludeForeignInactiveAndExistingSourcesAndPreserveSnapshots() {
        var owner = user("CREATOR"); var v = populated(owner); var foreign = user("CREATOR");
        questions.create(foreign.id(), input(QuestionType.TRUE_FALSE, null, "Foreign"));
        var archived = questions.create(owner.id(), input(QuestionType.TRUE_FALSE, null, "Archived"));
        questions.archive(owner.id(), archived.id(), archived.revision());
        questions.create(owner.id(), new QuestionDtos.WriteQuestion(QuestionType.TRUE_FALSE, QuestionStatus.DRAFT, "Draft", null, Difficulty.EASY, "Math", List.of(), List.of(), true, null, "0", null));
        var tf = questions.create(owner.id(), input(QuestionType.TRUE_FALSE, null, "Selected"));
        var num = questions.create(owner.id(), input(QuestionType.NUMERIC_ANSWER, null, "Numeric"));
        var matrix = new MatrixRequest(v.revision(), List.of(new MatrixRule(" mAtH ", Difficulty.EASY, null, 1), new MatrixRule(null, null, QuestionType.TRUE_FALSE, 1)));
        var preview = service.previewMatrix(owner.id(), v.id(), matrix);
        assertThat(preview.canGenerate()).isTrue();
        assertThat(preview.rules()).extracting(RuleAvailability::candidateCount).containsExactly(2, 1);
        assertThat(service.version(owner.id(), v.id())).isEqualTo(v);
        var generated = service.generate(owner.id(), v.id(), matrix);
        assertThat(generated.questions()).hasSize(3);
        assertThat(generated.questions().getFirst()).isEqualTo(v.questions().getFirst());
        assertThat(generated.questions().get(1).sourceQuestionId()).isEqualTo(num.id());
        assertThat(generated.questions().get(2).sourceQuestionId()).isEqualTo(tf.id());
        assertThat(generated.totalScore()).isEqualTo("3");
        assertThat(generated.revision()).isEqualTo(v.revision() + 1);
        questions.update(owner.id(), tf.id(), input(tf.type(), tf.revision(), "Changed"));
        questions.archive(owner.id(), num.id(), num.revision());
        assertThat(service.publish(owner.id(), v.id(), generated.revision()).questions()).isEqualTo(generated.questions());
    }
    @Test void insufficientOverlappingMatrixReturnsStructuredShortfallAndDoesNotWriteAnything() throws Exception {
        var owner = user("CREATOR"); var v = populated(owner);
        questions.create(owner.id(), input(QuestionType.TRUE_FALSE, null, "Only candidate"));
        var matrix = new MatrixRequest(v.revision(), List.of(new MatrixRule(null, null, null, 1), new MatrixRule(null, null, null, 1)));
        var beforeExam = service.detail(owner.id(), v.examId());
        var preview = service.previewMatrix(owner.id(), v.id(), matrix);
        assertThat(preview.canGenerate()).isFalse();
        assertThat(preview.rules()).extracting(RuleAvailability::allocatedCount).containsExactly(1, 0);
        mvc.perform(post("/api/v1/exam-versions/" + v.id() + "/generation").with(as(owner)).contentType("application/json").content(mapper.writeValueAsString(matrix)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXAM_MATRIX_INSUFFICIENT_CANDIDATES"))
                .andExpect(jsonPath("$.availability.rules[1].missingCount").value(1))
                .andExpect(jsonPath("$.availability.rules[1].candidateCount").value(1));
        assertThat(service.version(owner.id(), v.id())).isEqualTo(v);
        assertThat(service.detail(owner.id(), v.examId())).isEqualTo(beforeExam);
    }
    @Test void matrixHttpAuthorizationValidationAndPublishedGuards() throws Exception {
        var owner = user("CREATOR"); var v = populated(owner); var other = user("CREATOR"); var participant = user("PARTICIPANT");
        var admin = user("PARTICIPANT");
        jdbc.update("delete from user_roles where user_id=?", admin.id());
        jdbc.update("insert into user_roles(user_id,role) values (?,'ADMIN')", admin.id());
        var request = new MatrixRequest(v.revision(), List.of(new MatrixRule(null, null, null, 1)));
        String json = mapper.writeValueAsString(request);
        for (String suffix : List.of("/generation", "/generation/preview")) {
            String path = "/api/v1/exam-versions/" + v.id() + suffix;
            mvc.perform(post(path).contentType("application/json").content(json)).andExpect(status().isUnauthorized());
            mvc.perform(post(path).with(as(other)).contentType("application/json").content(json)).andExpect(status().isNotFound());
            for (var forbidden : List.of(participant, admin)) mvc.perform(post(path).with(as(forbidden)).contentType("application/json").content(json)).andExpect(status().isForbidden());
            for (String invalid : List.of("{\"revision\":1,\"rules\":[]}", "{\"revision\":1,\"rules\":[null]}",
                    "{\"revision\":1,\"rules\":[{\"quantity\":0}]}", "{\"revision\":1,\"rules\":[{\"quantity\":1,\"ownerId\":\"bad\"}]}",
                    "{\"revision\":1,\"rules\":[{\"quantity\":1.5}]}", "{\"revision\":1,\"rules\":[{\"quantity\":\"1\"}]}",
                    "{\"revision\":1,\"rules\":[{\"quantity\":501}]}", "{\"revision\":1,\"rules\":[{\"quantity\":300},{\"quantity\":300}]}"))
                mvc.perform(post(path).with(as(owner)).contentType("application/json").content(invalid)).andExpect(status().isBadRequest());
        }
        service.publish(owner.id(), v.id(), v.revision());
        for (String suffix : List.of("/generation", "/generation/preview")) mvc.perform(post("/api/v1/exam-versions/" + v.id() + suffix).with(as(owner)).contentType("application/json").content(json))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXAM_VERSION_IMMUTABLE"));
    }
    @Test void generateRacingGenerateSaveOrPublishHasOnlyOneWinner() throws Exception {
        for (String competitor : List.of("generate", "save", "publish")) {
            var owner = user("CREATOR"); var v = populated(owner);
            questions.create(owner.id(), input(QuestionType.TRUE_FALSE, null, "Candidate"));
            var matrix = new MatrixRequest(v.revision(), List.of(new MatrixRule(null, null, null, 1)));
            var result = concurrently(() -> attempt(() -> service.generate(owner.id(), v.id(), matrix)), () -> attempt(() -> {
                switch (competitor) {
                    case "generate" -> service.generate(owner.id(), v.id(), matrix);
                    case "save" -> service.save(owner.id(), v.id(), new SaveQuestions(v.revision(), List.of(new QuestionEdit(v.questions().getFirst().id(), "2"))));
                    default -> service.publish(owner.id(), v.id(), v.revision());
                }
            }));
            assertThat(result.stream().filter("OK"::equals).count()).isEqualTo(1);
            var after = service.version(owner.id(), v.id());
            assertThat(after.revision()).isEqualTo(v.revision() + 1);
            assertThat(after.questions()).extracting(QuestionView::sourceQuestionId).doesNotHaveDuplicates();
            assertThat(after.questions().size()).isBetween(1, 2);
        }
    }
    @Test void sourceChangedWhileGenerateWaitsOnItsLockRollsBackEverySnapshot() throws Exception {
        for (boolean archive : List.of(false, true)) {
            var owner = user("CREATOR"); var v = populated(owner);
            var q = questions.create(owner.id(), input(QuestionType.TRUE_FALSE, null, "Candidate"));
            questions.create(owner.id(), input(QuestionType.NUMERIC_ANSWER, null, "Second"));
            var matrix = new MatrixRequest(v.revision(), List.of(new MatrixRule(null, null, null, 2)));
            var beforeExam = service.detail(owner.id(), v.examId());
            try (var connection = dataSource.getConnection(); var pool = Executors.newVirtualThreadPerTaskExecutor()) {
                connection.setAutoCommit(false);
                int blocker;
                try (var statement = connection.createStatement(); var rows = statement.executeQuery("select pg_backend_pid()")) { rows.next(); blocker = rows.getInt(1); }
                try (var statement = connection.prepareStatement("select id from questions where id=? for update")) { statement.setObject(1, q.id()); statement.executeQuery().close(); }
                var generating = pool.submit(() -> service.generate(owner.id(), v.id(), matrix));
                try {
                    long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
                    boolean waiting = false;
                    while (System.nanoTime() < until) {
                        waiting = Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from pg_stat_activity where ? = any(pg_blocking_pids(pid)))", Boolean.class, blocker));
                        if (waiting) break;
                        Thread.sleep(20);
                    }
                    assertThat(waiting).as("generate must reach the locked source before it changes").isTrue();
                    try (var statement = connection.prepareStatement(archive
                            ? "update questions set status='ARCHIVED',revision=revision+1 where id=?"
                            : "update questions set category='Changed',revision=revision+1 where id=?")) { statement.setObject(1, q.id()); statement.executeUpdate(); }
                } finally { connection.commit(); }
                assertThatThrownBy(() -> generating.get(10, TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class).hasCauseInstanceOf(QuestionFailure.class);
            }
            assertThat(service.version(owner.id(), v.id())).isEqualTo(v);
            assertThat(service.detail(owner.id(), v.examId())).isEqualTo(beforeExam);
        }
    }
    private VersionDetail populated(AuthDtos.UserSummary owner) {
        var e = service.create(owner.id(), new CreateExam("Exam", null));
        var q = questions.create(owner.id(), input(QuestionType.SINGLE_CHOICE, null, "Original"));
        var added = service.add(owner.id(), e.versions().getFirst().id(), new AddQuestions(0L, List.of(new Source(q.id(), q.revision()))));
        // Đối chiếu trạng thái persisted với độ chính xác timestamp của PostgreSQL.
        return service.version(owner.id(), added.id());
    }
    private QuestionDtos.WriteQuestion input(QuestionType type, Long revision, String content) {
        boolean choice = type == QuestionType.SINGLE_CHOICE || type == QuestionType.MULTIPLE_CHOICE;
        return new QuestionDtos.WriteQuestion(type, QuestionStatus.ACTIVE, content, "Explanation", Difficulty.EASY, "Math", List.of("math"),
                choice ? List.of(new QuestionDtos.Option("A", true), new QuestionDtos.Option("B", type == QuestionType.MULTIPLE_CHOICE)) : List.of(),
                type == QuestionType.TRUE_FALSE ? false : null, type == QuestionType.NUMERIC_ANSWER ? "12345678901234567890.1234567891" : null, "0", revision);
    }
    private List<String> concurrently(Callable<String> a, Callable<String> b) throws Exception {
        var gate = new CountDownLatch(1);
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = pool.submit(() -> { gate.await(); return a.call(); }); var second = pool.submit(() -> { gate.await(); return b.call(); });
            gate.countDown(); return List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
        }
    }
    private String attempt(Runnable task) { try { task.run(); return "OK"; } catch (ExamFailure ex) { return ex.code; } }
    private void assertCode(Runnable task, String code) { assertThatThrownBy(task::run).isInstanceOfSatisfying(ExamFailure.class, ex -> assertThat(ex.code).isEqualTo(code)); }
    private AuthDtos.UserSummary user(String role) { return identity.register(new AuthDtos.RegisterRequest(UUID.randomUUID() + "@example.com", "Exam test password 123", "Test", List.of(role))); }
    private RequestPostProcessor as(AuthDtos.UserSummary user) {
        String token = tokens.issue(user, UUID.randomUUID().toString()).accessToken();
        return request -> { request.addHeader("Authorization", "Bearer " + token); return request; };
    }
}
