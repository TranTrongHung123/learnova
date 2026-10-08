package com.learnova.session;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.learnova.TestcontainersConfiguration;
import com.learnova.classroom.dto.ClassroomDtos.WriteClassroom;
import com.learnova.classroom.service.ClassroomService;
import com.learnova.exam.dto.ExamDtos.*;
import com.learnova.exam.service.ExamService;
import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.security.AccessTokens;
import com.learnova.identity.service.IdentityService;
import com.learnova.question.dto.QuestionDtos;
import com.learnova.question.enums.*;
import com.learnova.question.service.QuestionService;
import com.learnova.session.dto.SessionDtos.*;
import com.learnova.session.enums.*;
import com.learnova.session.exception.SessionFailure;
import com.learnova.session.service.*;
import com.learnova.shared.api.PageQuery;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = "learnova.session.lifecycle-delay-ms=3600000")
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, SessionIntegrationTests.TimeConfig.class })
class SessionIntegrationTests {

    static class MutableClock extends Clock {

        volatile Instant time = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);

        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        public Clock withZone(ZoneId zone) {
            return this;
        }

        public Instant instant() {
            return time;
        }
    }

    @TestConfiguration
    static class TimeConfig {

        @Bean
        @Primary
        MutableClock sessionTestClock() {
            return new MutableClock();
        }
    }

    @Autowired
    MutableClock clock;

    @Autowired
    SessionService service;

    @Autowired
    SessionLifecycle lifecycle;

    @Autowired
    SessionAdmission admission;

    @Autowired
    ExamService exams;

    @Autowired
    ClassroomService classrooms;

    @Autowired
    QuestionService questions;

    @Autowired
    IdentityService identity;

    @Autowired
    AccessTokens tokens;

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    PlatformTransactionManager transactions;

    @Autowired
    javax.sql.DataSource dataSource;

    @BeforeEach
    void resetTime() {
        clock.time = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
    }

    @Test
    void publicLifecycleUsesServerBoundariesEvenWhenSchedulerHasNotRun() {
        var owner = user("CREATOR");
        var version = published(owner);
        var s = service.create(
            owner.id(),
            input(version.id(), AccessType.PUBLIC, List.of(), List.of())
        );
        assertThat(s.resultDisplayMode()).isEqualTo(ResultDisplayMode.SUMMARY);
        assertThat(s.resultReleasePolicy()).isEqualTo(ResultReleasePolicy.AFTER_SESSION_END);
        assertThat(s.assignedParticipantCount()).isNull();
        s = service.schedule(owner.id(), s.id(), s.revision());
        assertThat(s.status()).isEqualTo(SessionStatus.SCHEDULED);
        clock.time = s.startTime();
        assertThat(
            service
                .list(owner.id(), SessionStatus.OPEN, null, null, new PageQuery(0, 20))
                .totalElements()
        ).isEqualTo(1);
        var before = s;
        assertCode(
            () -> service.cancel(owner.id(), before.id(), before.revision()),
            "SESSION_INVALID_STATE"
        );
        assertThat(service.detail(owner.id(), s.id()).actions().editConfiguration()).isFalse();
        clock.time = s.endTime();
        assertThat(
            service
                .list(owner.id(), SessionStatus.CLOSED, null, null, new PageQuery(0, 20))
                .totalElements()
        ).isEqualTo(1);
        assertThat(
            service
                .list(owner.id(), SessionStatus.OPEN, null, null, new PageQuery(0, 20))
                .totalElements()
        ).isZero();
        assertCode(
            () ->
                service.extend(
                    owner.id(),
                    before.id(),
                    new Extend(before.revision(), clock.time.plusSeconds(600))
                ),
            "SESSION_INVALID_STATE"
        );
        assertThat(lifecycle.due()).contains(s.id());
        lifecycle.advance(s.id());
        assertThat(
            jdbc.queryForObject("select status from exam_sessions where id=?", String.class, s.id())
        ).isEqualTo("CLOSED");
    }

    @Test
    void scheduleOpensImmediatelyDraftDoesNotAdvanceAndExpiredDraftCannotSchedule() {
        var owner = user("CREATOR");
        var s = service.create(
            owner.id(),
            input(published(owner).id(), AccessType.PUBLIC, List.of(), List.of())
        );
        clock.time = s.startTime();
        lifecycle.advance(s.id());
        assertThat(service.detail(owner.id(), s.id()).status()).isEqualTo(SessionStatus.DRAFT);
        assertThat(service.schedule(owner.id(), s.id(), s.revision()).status()).isEqualTo(
            SessionStatus.OPEN
        );
        var expired = service.create(
            owner.id(),
            input(published(owner).id(), AccessType.PUBLIC, List.of(), List.of())
        );
        clock.time = expired.endTime();
        assertCode(
            () -> service.schedule(owner.id(), expired.id(), expired.revision()),
            "VALIDATION_FAILED"
        );
    }

    @Test
    void draftPublishedOwnershipArchiveAndStrictHttpValidation() throws Exception {
        var owner = user("CREATOR");
        var other = user("CREATOR");
        var participant = user("PARTICIPANT");
        var v = published(owner);
        var request = input(v.id(), AccessType.PUBLIC, List.of(), List.of());
        mvc.perform(
            post("/api/v1/exam-sessions")
                .contentType("application/json")
                .content(mapper.writeValueAsString(request))
        ).andExpect(status().isUnauthorized());
        mvc.perform(
            post("/api/v1/exam-sessions")
                .with(as(participant))
                .contentType("application/json")
                .content(mapper.writeValueAsString(request))
        ).andExpect(status().isForbidden());
        mvc.perform(
            post("/api/v1/exam-sessions")
                .with(as(other))
                .contentType("application/json")
                .content(mapper.writeValueAsString(request))
        ).andExpect(status().isNotFound());
        var s = service.create(owner.id(), request);
        mvc.perform(get("/api/v1/exam-sessions/" + s.id()).with(as(other))).andExpect(
            status().isNotFound()
        );
        mvc.perform(get("/api/v1/exam-sessions/" + s.id()).with(as(owner)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.questions").doesNotExist());
        var node = mapper.valueToTree(request);
        for (String field : List.of("durationMinutes", "maxAttempts")) {
            var body = (tools.jackson.databind.node.ObjectNode) node.deepCopy();
            body.put(field, 1.5);
            mvc.perform(
                post("/api/v1/exam-sessions")
                    .with(as(owner))
                    .contentType("application/json")
                    .content(mapper.writeValueAsString(body))
            ).andExpect(status().isBadRequest());
        }
        for (String score : List.of("-1", "2", "1e0", "0.00000000001")) {
            var body = (tools.jackson.databind.node.ObjectNode) node.deepCopy();
            body.put("passingScore", score);
            mvc.perform(
                post("/api/v1/exam-sessions")
                    .with(as(owner))
                    .contentType("application/json")
                    .content(mapper.writeValueAsString(body))
            ).andExpect(status().isBadRequest());
        }
        var body = (tools.jackson.databind.node.ObjectNode) node.deepCopy();
        body.put("firstAttemptAt", clock.instant().toString());
        mvc.perform(
            post("/api/v1/exam-sessions")
                .with(as(owner))
                .contentType("application/json")
                .content(mapper.writeValueAsString(body))
        ).andExpect(status().isBadRequest());
        var draft = exams.createVersion(owner.id(), v.examId(), new NewVersion(null));
        assertThatThrownBy(() ->
            service.create(owner.id(), input(draft.id(), AccessType.PUBLIC, List.of(), List.of()))
        ).hasMessage("EXAM_VERSION_NOT_PUBLISHED");
        exams.archive(owner.id(), v.examId(), exams.detail(owner.id(), v.examId()).revision());
        assertThatThrownBy(() -> service.schedule(owner.id(), s.id(), s.revision())).hasMessage(
            "EXAM_ARCHIVED"
        );
        assertThatThrownBy(() -> service.create(owner.id(), request)).hasMessage("EXAM_ARCHIVED");
    }

    @Test
    void classAndIndividualAssignmentsValidateTargetsAndUseLiveMembership() {
        var owner = user("CREATOR");
        var other = user("CREATOR");
        var p = user("PARTICIPANT");
        var v = published(owner);
        var c = classrooms.create(owner.id(), new WriteClassroom("Class", null));
        var foreign = classrooms.create(other.id(), new WriteClassroom("Foreign", null));
        assertThatThrownBy(() ->
            service.create(
                owner.id(),
                input(v.id(), AccessType.CLASS, List.of(foreign.id()), List.of())
            )
        ).hasMessage("CLASSROOM_NOT_FOUND");
        assertCode(
            () ->
                service.create(
                    owner.id(),
                    input(v.id(), AccessType.CLASS, List.of(c.id(), c.id()), List.of())
                ),
            "VALIDATION_FAILED"
        );
        assertCode(
            () ->
                service.create(
                    owner.id(),
                    input(v.id(), AccessType.PUBLIC, List.of(c.id()), List.of())
                ),
            "VALIDATION_FAILED"
        );
        assertCode(
            () ->
                service.create(
                    owner.id(),
                    input(v.id(), AccessType.INDIVIDUAL, List.of(), List.of(owner.id()))
                ),
            "SESSION_INVALID_PARTICIPANT"
        );
        var s = service.create(
            owner.id(),
            input(v.id(), AccessType.CLASS, List.of(c.id()), List.of())
        );
        assertThat(s.classrooms()).extracting(Target::name).containsExactly("Class");
        classrooms.add(owner.id(), c.id(), p.id());
        assertThat(service.detail(owner.id(), s.id()).assignedParticipantCount()).isEqualTo(1);
        classrooms.remove(owner.id(), c.id(), p.id());
        assertThat(service.detail(owner.id(), s.id()).assignedParticipantCount()).isZero();
        assertThat(
            service.list(owner.id(), null, null, c.id(), new PageQuery(0, 20)).totalElements()
        ).isEqualTo(1);
        var individual = service.create(
            owner.id(),
            input(v.id(), AccessType.INDIVIDUAL, List.of(), List.of(p.id()))
        );
        assertThat(individual.participants()).extracting(Target::id).containsExactly(p.id());
        jdbc.update("update users set status='LOCKED' where id=?", p.id());
        assertCode(
            () -> service.schedule(owner.id(), individual.id(), individual.revision()),
            "SESSION_INVALID_PARTICIPANT"
        );
    }

    @Test
    void configurationLocksExtensionAndAdmissionRollbackAreAtomic() {
        var owner = user("CREATOR");
        var p = user("PARTICIPANT");
        var s = service.create(
            owner.id(),
            input(published(owner).id(), AccessType.PUBLIC, List.of(), List.of())
        );
        var scheduled = service.schedule(owner.id(), s.id(), s.revision());
        clock.time = scheduled.startTime();
        var tx = new TransactionTemplate(transactions);
        assertThatThrownBy(() -> admission.reserve(p.id(), s.id())).isInstanceOf(
            org.springframework.transaction.IllegalTransactionStateException.class
        );
        tx.executeWithoutResult(t -> {
            admission.reserve(p.id(), s.id());
            t.setRollbackOnly();
        });
        assertThat(service.detail(owner.id(), s.id()).hasAttempts()).isFalse();
        var admitted = tx.execute(t -> admission.reserve(p.id(), s.id()));
        var current = service.detail(owner.id(), s.id());
        assertThat(current.hasAttempts()).isTrue();
        assertThat(current.actions().cancel()).isFalse();
        var renamed = service.update(
            owner.id(),
            s.id(),
            copy(current, "Renamed", current.durationMinutes())
        );
        assertCode(
            () -> service.update(owner.id(), s.id(), copy(renamed, "Changed", 99)),
            "SESSION_CONFIG_LOCKED"
        );
        var extended = service.extend(
            owner.id(),
            s.id(),
            new Extend(renamed.revision(), s.endTime().plusSeconds(600))
        );
        assertThat(admitted.deadline()).isEqualTo(s.endTime());
        assertThat(extended.endTime()).isAfter(admitted.deadline());
        assertThat(
            jdbc.queryForObject(
                "select count(*) from audit_records where target_id=? and action='SESSION_END_TIME_EXTENDED'",
                Integer.class,
                s.id().toString()
            )
        ).isEqualTo(1);
        assertCode(
            () ->
                service.extend(
                    owner.id(),
                    s.id(),
                    new Extend(extended.revision(), extended.endTime())
                ),
            "VALIDATION_FAILED"
        );
    }

    @Test
    void concurrentUpdatesAndScheduleCancelHaveOneWinner() throws Exception {
        var owner = user("CREATOR");
        var s = service.create(
            owner.id(),
            input(published(owner).id(), AccessType.PUBLIC, List.of(), List.of())
        );
        assertThat(
            concurrent(
                () -> service.update(owner.id(), s.id(), copy(s, "A", 30)),
                () -> service.update(owner.id(), s.id(), copy(s, "B", 30))
            )
        ).containsExactlyInAnyOrder("OK", "SESSION_REVISION_CONFLICT");
        var current = service.detail(owner.id(), s.id());
        assertThat(
            concurrent(
                () -> service.schedule(owner.id(), s.id(), current.revision()),
                () -> service.cancel(owner.id(), s.id(), current.revision())
            )
        ).containsExactlyInAnyOrder("OK", "SESSION_REVISION_CONFLICT");
    }

    @Test
    void firstAttemptGuardAlsoProtectsInconsistentDraftAndScheduledFixtures() {
        var owner = user("CREATOR");
        var s = service.create(
            owner.id(),
            input(published(owner).id(), AccessType.PUBLIC, List.of(), List.of())
        );
        jdbc.update(
            "update exam_sessions set first_attempt_at=? where id=?",
            java.sql.Timestamp.from(clock.instant()),
            s.id()
        );
        assertCode(() -> service.cancel(owner.id(), s.id(), s.revision()), "SESSION_INVALID_STATE");
        assertCode(
            () -> service.update(owner.id(), s.id(), copy(s, "Changed", 99)),
            "SESSION_CONFIG_LOCKED"
        );
        assertCode(
            () -> service.schedule(owner.id(), s.id(), s.revision()),
            "SESSION_INVALID_STATE"
        );
    }

    @Test
    void admissionHoldsTheSameRowLockAsExtensionUntilCallerCommits() throws Exception {
        var owner = user("CREATOR");
        var participant = user("PARTICIPANT");
        var draft = service.create(
            owner.id(),
            input(published(owner).id(), AccessType.PUBLIC, List.of(), List.of())
        );
        var scheduled = service.schedule(owner.id(), draft.id(), draft.revision());
        clock.time = scheduled.startTime();
        var reserved = new CountDownLatch(1);
        var commit = new CountDownLatch(1);
        var blocker = new java.util.concurrent.atomic.AtomicInteger();
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var starting = pool.submit(() ->
                new TransactionTemplate(transactions).execute(tx -> {
                    blocker.set(jdbc.queryForObject("select pg_backend_pid()", Integer.class));
                    var result = admission.reserve(participant.id(), draft.id());
                    reserved.countDown();
                    try {
                        if (!commit.await(15, TimeUnit.SECONDS)) throw new IllegalStateException(
                            "Timed out awaiting test commit"
                        );
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException(ex);
                    }
                    return result;
                })
            );
            try {
                assertThat(reserved.await(10, TimeUnit.SECONDS)).isTrue();
                var extending = pool.submit(() ->
                    outcome(() ->
                        service.extend(
                            owner.id(),
                            draft.id(),
                            new Extend(scheduled.revision(), scheduled.endTime().plusSeconds(600))
                        )
                    )
                );
                long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
                boolean waiting = false;
                while (System.nanoTime() < until) {
                    waiting = Boolean.TRUE.equals(
                        jdbc.queryForObject(
                            "select exists(select 1 from pg_stat_activity where ?=any(pg_blocking_pids(pid)))",
                            Boolean.class,
                            blocker.get()
                        )
                    );
                    if (waiting) break;
                    Thread.sleep(20);
                }
                assertThat(waiting)
                    .as("extend waits for the transaction reserving admission")
                    .isTrue();
                commit.countDown();
                assertThat(starting.get(10, TimeUnit.SECONDS).deadline()).isEqualTo(
                    scheduled.endTime()
                );
                assertThat(extending.get(10, TimeUnit.SECONDS)).isEqualTo(
                    "SESSION_REVISION_CONFLICT"
                );
            } finally {
                commit.countDown();
            }
        }
        var current = service.detail(owner.id(), draft.id());
        assertThat(current.hasAttempts()).isTrue();
        assertThat(current.endTime()).isEqualTo(scheduled.endTime());
    }

    @Test
    void migrationFromV8PreservesHistoricalVersion() {
        String schema = "session_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        org.flywaydb.core.Flyway.configure()
            .dataSource(dataSource)
            .schemas(schema)
            .defaultSchema(schema)
            .target("8")
            .load()
            .migrate();
        UUID user = UUID.randomUUID(),
            exam = UUID.randomUUID(),
            version = UUID.randomUUID();
        jdbc.update(
            "insert into " +
                schema +
                ".users(id,email,display_name,status,created_at,onboarding_completed) values (?,?,'Old owner','ACTIVE',now(),true)",
            user,
            user + "@example.com"
        );
        jdbc.update(
            "insert into " +
                schema +
                ".exams(id,owner_id,name,status,revision,created_at,updated_at) values (?,?,'Old exam','ACTIVE',0,now(),now())",
            exam,
            user
        );
        jdbc.update(
            "insert into " +
                schema +
                ".exam_versions(id,exam_id,version_number,status,revision,created_at,updated_at,published_at) values (?,?,1,'PUBLISHED',1,now(),now(),now())",
            version,
            exam
        );
        org.flywaydb.core.Flyway.configure()
            .dataSource(dataSource)
            .schemas(schema)
            .defaultSchema(schema)
            .load()
            .migrate();
        assertThat(
            jdbc.queryForObject(
                "select status from " + schema + ".exam_versions where id=?",
                String.class,
                version
            )
        ).isEqualTo("PUBLISHED");
        assertThat(
            jdbc.queryForObject("select count(*) from " + schema + ".exam_sessions", Integer.class)
        ).isZero();
    }

    @Test
    void outerRollbackRemovesSessionAndItsAudit() {
        var owner = user("CREATOR");
        var version = published(owner);
        UUID[] id = new UUID[1];
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            id[0] = service
                .create(owner.id(), input(version.id(), AccessType.PUBLIC, List.of(), List.of()))
                .id();
            tx.setRollbackOnly();
        });
        assertThat(
            jdbc.queryForObject(
                "select count(*) from exam_sessions where id=?",
                Integer.class,
                id[0]
            )
        ).isZero();
        assertThat(
            jdbc.queryForObject(
                "select count(*) from audit_records where target_id=?",
                Integer.class,
                id[0].toString()
            )
        ).isZero();
    }

    @Test
    void scheduledEditsCannotShortenEndAndCannotMoveStartToNow() {
        var owner = user("CREATOR");
        var draft = service.create(
            owner.id(),
            input(published(owner).id(), AccessType.PUBLIC, List.of(), List.of())
        );
        var s = service.schedule(owner.id(), draft.id(), draft.revision());
        var old = copy(s, "New", 40);
        assertCode(
            () ->
                service.update(
                    owner.id(),
                    s.id(),
                    new WriteSession(
                        s.revision(),
                        old.title(),
                        old.examVersionId(),
                        old.startTime(),
                        old.endTime().minusSeconds(1),
                        40,
                        2,
                        "0.5",
                        AccessType.PUBLIC,
                        List.of(),
                        List.of(),
                        false,
                        false,
                        null,
                        null
                    )
                ),
            "SESSION_USE_EXTEND_COMMAND"
        );
        assertCode(
            () ->
                service.update(
                    owner.id(),
                    s.id(),
                    new WriteSession(
                        s.revision(),
                        old.title(),
                        old.examVersionId(),
                        clock.instant(),
                        old.endTime(),
                        40,
                        2,
                        "0.5",
                        AccessType.PUBLIC,
                        List.of(),
                        List.of(),
                        false,
                        false,
                        null,
                        null
                    )
                ),
            "VALIDATION_FAILED"
        );
        assertThat(service.update(owner.id(), s.id(), old).durationMinutes()).isEqualTo(40);
    }

    @Test
    void admissionUsesCurrentMembershipAndAssignedIdsAndRequiresParticipant() {
        var owner = user("CREATOR");
        var p = user("PARTICIPANT");
        var other = user("PARTICIPANT");
        var c = classrooms.create(owner.id(), new WriteClassroom("Class", null));
        var draft = service.create(
            owner.id(),
            input(published(owner).id(), AccessType.CLASS, List.of(c.id()), List.of())
        );
        var s = service.schedule(owner.id(), draft.id(), draft.revision());
        clock.time = s.startTime();
        var tx = new TransactionTemplate(transactions);
        assertCode(
            () -> tx.execute(t -> admission.reserve(p.id(), s.id())),
            "SESSION_NOT_ASSIGNED"
        );
        classrooms.add(owner.id(), c.id(), p.id());
        var classAdmission = tx.execute(t -> admission.reserve(p.id(), s.id()));
        assertThat(classAdmission).isNotNull();
        classrooms.remove(owner.id(), c.id(), p.id());
        assertCode(
            () -> tx.execute(t -> admission.reserve(p.id(), s.id())),
            "SESSION_NOT_ASSIGNED"
        );
        assertCode(() -> tx.execute(t -> admission.reserve(owner.id(), s.id())), "FORBIDDEN");
        var individual = service.create(
            owner.id(),
            input(published(owner).id(), AccessType.INDIVIDUAL, List.of(), List.of(p.id()))
        );
        service.schedule(owner.id(), individual.id(), individual.revision());
        clock.time = individual.startTime();
        assertCode(
            () -> tx.execute(t -> admission.reserve(other.id(), individual.id())),
            "SESSION_NOT_ASSIGNED"
        );
        var individualAdmission = tx.execute(t -> admission.reserve(p.id(), individual.id()));
        assertThat(individualAdmission).isNotNull();
    }

    @Test
    void concurrentArchiveAndCreateSerializeAndScheduledHistorySurvivesArchive() throws Exception {
        var owner = user("CREATOR");
        var v = published(owner);
        var current = exams.detail(owner.id(), v.examId());
        var gate = new CountDownLatch(1);
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var create = pool.submit(() -> {
                gate.await();
                try {
                    return service.create(
                        owner.id(),
                        input(v.id(), AccessType.PUBLIC, List.of(), List.of())
                    );
                } catch (com.learnova.exam.exception.ExamFailure ex) {
                    assertThat(ex.code).isEqualTo("EXAM_ARCHIVED");
                    return null;
                }
            });
            var archive = pool.submit(() -> {
                gate.await();
                return exams.archive(owner.id(), v.examId(), current.revision());
            });
            gate.countDown();
            var created = create.get(20, TimeUnit.SECONDS);
            archive.get(20, TimeUnit.SECONDS);
            if (created != null) assertThat(
                service.detail(owner.id(), created.id()).status()
            ).isEqualTo(SessionStatus.DRAFT);
        }
        var active = published(owner);
        var d = service.create(
            owner.id(),
            input(active.id(), AccessType.PUBLIC, List.of(), List.of())
        );
        var scheduled = service.schedule(owner.id(), d.id(), d.revision());
        exams.archive(
            owner.id(),
            active.examId(),
            exams.detail(owner.id(), active.examId()).revision()
        );
        assertThat(service.detail(owner.id(), d.id()).status()).isEqualTo(SessionStatus.SCHEDULED);
        assertThat(
            service
                .update(owner.id(), d.id(), copy(scheduled, "Renamed", scheduled.durationMinutes()))
                .title()
        ).isEqualTo("Renamed");
    }

    private WriteSession copy(Detail s, String title, int duration) {
        return new WriteSession(
            s.revision(),
            title,
            s.examVersionId(),
            s.startTime(),
            s.endTime(),
            duration,
            s.maxAttempts(),
            s.passingScore(),
            s.accessType(),
            s.classrooms().stream().map(Target::id).toList(),
            s.participants().stream().map(Target::id).toList(),
            s.shuffleQuestions(),
            s.shuffleAnswers(),
            s.resultDisplayMode(),
            s.resultReleasePolicy()
        );
    }

    private WriteSession input(
        UUID version,
        AccessType access,
        List<UUID> classes,
        List<UUID> users
    ) {
        return new WriteSession(
            null,
            "Session",
            version,
            clock.instant().plusSeconds(60),
            clock.instant().plusSeconds(1260),
            30,
            2,
            "0.5",
            access,
            classes,
            users,
            false,
            false,
            null,
            null
        );
    }

    private VersionDetail published(AuthDtos.UserSummary owner) {
        var e = exams.create(owner.id(), new CreateExam("Exam", null));
        var q = questions.create(
            owner.id(),
            new QuestionDtos.WriteQuestion(
                QuestionType.TRUE_FALSE,
                QuestionStatus.ACTIVE,
                "True?",
                null,
                Difficulty.EASY,
                null,
                List.of(),
                List.of(),
                true,
                null,
                null,
                null
            )
        );
        var v = exams.add(
            owner.id(),
            e.versions().getFirst().id(),
            new AddQuestions(0L, List.of(new Source(q.id(), q.revision())))
        );
        return exams.publish(owner.id(), v.id(), v.revision());
    }

    private List<String> concurrent(Runnable a, Runnable b) throws Exception {
        var gate = new CountDownLatch(1);
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var one = pool.submit(() -> {
                gate.await();
                return outcome(a);
            });
            var two = pool.submit(() -> {
                gate.await();
                return outcome(b);
            });
            gate.countDown();
            return List.of(one.get(20, TimeUnit.SECONDS), two.get(20, TimeUnit.SECONDS));
        }
    }

    private String outcome(Runnable task) {
        try {
            task.run();
            return "OK";
        } catch (SessionFailure ex) {
            return ex.code;
        }
    }

    private void assertCode(Runnable task, String code) {
        assertThatThrownBy(task::run).isInstanceOfSatisfying(SessionFailure.class, e ->
            assertThat(e.code).isEqualTo(code)
        );
    }

    private AuthDtos.UserSummary user(String role) {
        return identity.register(
            new AuthDtos.RegisterRequest(
                UUID.randomUUID() + "@example.com",
                "Session test password 123",
                "Tester",
                List.of(role)
            )
        );
    }

    private RequestPostProcessor as(AuthDtos.UserSummary user) {
        String token = tokens.issue(user, UUID.randomUUID().toString()).accessToken();
        return r -> {
            r.addHeader("Authorization", "Bearer " + token);
            return r;
        };
    }
}
