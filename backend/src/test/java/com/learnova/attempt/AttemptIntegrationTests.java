package com.learnova.attempt;

import com.learnova.TestcontainersConfiguration;
import com.learnova.attempt.dto.AttemptDtos.*;
import com.learnova.attempt.service.AttemptService;
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
import com.learnova.session.service.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"learnova.session.lifecycle-delay-ms=3600000","learnova.attempt.finalization-delay-ms=3600000"})
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, AttemptIntegrationTests.TimeConfig.class})
class AttemptIntegrationTests {
    static class MutableClock extends Clock {
        volatile Instant time=Instant.now();
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return time; }
    }
    @TestConfiguration static class TimeConfig { @Bean @Primary MutableClock attemptClock() { return new MutableClock(); } }
    @Autowired MutableClock clock;
    @Autowired AttemptService attempts;
    @Autowired com.learnova.attempt.service.ResultService results;
    @Autowired com.learnova.reporting.service.ReportingService reporting;
    @Autowired com.learnova.attempt.service.AttemptFinalization finalization;
    @Autowired com.learnova.attempt.config.AttemptScheduler scheduler;
    @Autowired SessionService sessions;
    @Autowired ExamService exams;
    @Autowired ClassroomService classes;
    @Autowired QuestionService questions;
    @Autowired IdentityService identity;
    @Autowired AccessTokens tokens;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired javax.sql.DataSource dataSource;
    @Autowired com.learnova.monitoring.service.MonitoringService monitoring;
    @Autowired com.learnova.monitoring.controller.MonitoringSocket monitoringSocket;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactionManager;
    @org.springframework.beans.factory.annotation.Value("${local.server.port}") int port;
    @BeforeEach void time() { clock.time=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS); }
    record Fixture(AuthDtos.UserSummary owner,AuthDtos.UserSummary participant,Detail session,UUID classroom) {}

    @Test void monitoringPresenceIsSeparateAndOnlyCountsPersistedAnswers() throws Exception {
        var f=fixture(AccessType.INDIVIDUAL,false);
        assertThat(monitoring.snapshot(f.owner.id(),f.session.id()).summary().notStarted()).isEqualTo(1);
        open(f); var a=start(f);
        var initial=monitoring.snapshot(f.owner.id(),f.session.id());
        assertThat(initial.participants().getFirst().connectionStatus()).isEqualTo("CONNECTED");
        clock.time=clock.time.plusSeconds(45);
        var disconnected=monitoring.snapshot(f.owner.id(),f.session.id());
        assertThat(disconnected.summary().disconnected()).isEqualTo(1);
        assertThat(disconnected.participants().getFirst().status()).isEqualTo("IN_PROGRESS");
        mvc.perform(post("/api/v1/attempts/"+a.id()+"/heartbeat").with(as(f.participant))).andExpect(status().isNoContent());
        assertThat(monitoring.snapshot(f.owner.id(),f.session.id()).summary().disconnected()).isZero();
        var q=a.questions().stream().filter(x->x.type().equals("TRUE_FALSE")).findFirst().orElseThrow();
        attempts.save(f.participant.id(),a.id(),q.id(),new Save(0L,new Answer(List.of(),false,null),false,null));
        assertThat(monitoring.snapshot(f.owner.id(),f.session.id()).participants().getFirst().answeredCount()).isEqualTo(1);
        attempts.save(f.participant.id(),a.id(),q.id(),new Save(1L,Answer.empty(),false,null));
        assertThat(monitoring.snapshot(f.owner.id(),f.session.id()).participants().getFirst().answeredCount()).isZero();
        attempts.submit(f.participant.id(),a.id());
        var completed=monitoring.snapshot(f.owner.id(),f.session.id());
        assertThat(completed.summary().submitted()).isEqualTo(1);
        assertThat(completed.participants().getFirst().connectionStatus()).isEqualTo("NOT_APPLICABLE");
        assertThat(json.writeValueAsString(completed)).doesNotContain("SECRET", "correctBoolean", "optionIds", "rawScore");
    }
    @Test void monitoringOwnerRolePublicRosterAndLatestAttempt() throws Exception {
        var f=fixture(AccessType.PUBLIC,false); open(f);
        assertThat(monitoring.snapshot(f.owner.id(),f.session.id()).summary().notStarted()).isNull();
        var a=start(f); attempts.submit(f.participant.id(),a.id()); var b=start(f);
        var snapshot=monitoring.snapshot(f.owner.id(),f.session.id());
        assertThat(snapshot.participants()).hasSize(1);
        assertThat(snapshot.participants().getFirst().attemptId()).isEqualTo(b.id());
        mvc.perform(get("/api/v1/exam-sessions/"+f.session.id()+"/monitor").with(as(user("CREATOR")))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/exam-sessions/"+f.session.id()+"/monitor").with(as(f.participant))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/exam-sessions/"+f.session.id()+"/monitor")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/attempts/"+b.id()+"/heartbeat").with(as(user("PARTICIPANT")))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/exam-sessions/"+f.session.id()+"/monitor").with(as(f.owner))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
    }
    @Test void monitoringKeepsRemovedMembersAndDeduplicatesClassAudience() {
        var f=fixture(AccessType.CLASS,false); open(f); start(f);
        classes.remove(f.owner.id(),f.classroom,f.participant.id());
        assertThat(monitoring.snapshot(f.owner.id(),f.session.id()).participants()).hasSize(1);
        var p=user("PARTICIPANT"); classes.add(f.owner.id(),f.classroom,p.id());
        assertThat(monitoring.snapshot(f.owner.id(),f.session.id()).summary().notStarted()).isEqualTo(1);
    }
    static class SocketMessages implements java.net.http.WebSocket.Listener {
        final BlockingQueue<String> messages=new LinkedBlockingQueue<>();
        final BlockingQueue<Integer> closed=new LinkedBlockingQueue<>();
        final StringBuilder buffer=new StringBuilder();
        public void onOpen(java.net.http.WebSocket ws) { ws.request(1); }
        public CompletionStage<?> onText(java.net.http.WebSocket ws,CharSequence text,boolean last) {
            buffer.append(text); if(last) { messages.add(buffer.toString()); buffer.setLength(0); } ws.request(1); return null;
        }
        public CompletionStage<?> onClose(java.net.http.WebSocket ws,int code,String reason) { closed.add(code); return null; }
    }
    private java.net.http.WebSocket socket(SocketMessages listener,String origin) {
        return java.net.http.HttpClient.newHttpClient().newWebSocketBuilder().header("Origin",origin)
            .buildAsync(java.net.URI.create("ws://localhost:"+port+"/api/v1/monitoring/ws"),listener).join();
    }
    private String subscribe(AuthDtos.UserSummary actor,UUID session) {
        return json.writeValueAsString(Map.of("type","SUBSCRIBE","sessionId",session,"accessToken",tokens.issue(actor,"monitor-test").accessToken()));
    }
    @Test void websocketAuthorizesSubscriptionsOriginsTimeoutAndExpiry() throws Exception {
        var f=fixture(AccessType.PUBLIC,false); open(f);
        assertThatThrownBy(()->socket(new SocketMessages(),"https://untrusted.example")).isInstanceOf(CompletionException.class);
        var denied=new SocketMessages(); var other=socket(denied,"http://localhost:3000");
        other.sendText(subscribe(user("CREATOR"),f.session.id()),true).join();
        assertThat(denied.closed.poll(10,TimeUnit.SECONDS)).isEqualTo(4403); assertThat(denied.messages).isEmpty();
        var unauthenticated=new SocketMessages(); socket(unauthenticated,"http://localhost:3000");
        clock.time=clock.time.plusSeconds(11); monitoringSocket.update();
        assertThat(unauthenticated.closed.poll(10,TimeUnit.SECONDS)).isEqualTo(4401);
        var allowed=new SocketMessages(); var owner=socket(allowed,"http://localhost:3000");
        owner.sendText(subscribe(f.owner,f.session.id()),true).join();
        assertThat(json.readTree(allowed.messages.poll(10,TimeUnit.SECONDS)).path("type").asText()).isEqualTo("SYNC");
        clock.time=clock.time.plusSeconds(901); monitoringSocket.update();
        assertThat(allowed.closed.poll(10,TimeUnit.SECONDS)).isEqualTo(4401);
    }
    @Test void websocketSyncClosesRestGapAndNeverPublishesUncommittedAnswers() throws Exception {
        var f=fixture(AccessType.PUBLIC,false); open(f);
        assertThat(monitoring.snapshot(f.owner.id(),f.session.id()).participants()).isEmpty();
        var a=start(f); var listener=new SocketMessages(); var ws=socket(listener,"http://localhost:3000");
        ws.sendText(subscribe(f.owner,f.session.id()),true).join();
        var sync=json.readTree(listener.messages.poll(10,TimeUnit.SECONDS));
        assertThat(sync.path("changes").size()).isEqualTo(1);
        assertThat(sync.path("changes").get(0).path("participant").path("attemptId").asText()).isEqualTo(a.id().toString());
        var q=a.questions().stream().filter(x->x.type().equals("TRUE_FALSE")).findFirst().orElseThrow();
        try (var executor=Executors.newSingleThreadExecutor()) {
            new org.springframework.transaction.support.TransactionTemplate(transactionManager).executeWithoutResult(tx->{
                attempts.save(f.participant.id(),a.id(),q.id(),new Save(0L,new Answer(List.of(),true,null),false,null));
                try { executor.submit(()->monitoring.snapshot(f.owner.id(),f.session.id())).get(10,TimeUnit.SECONDS)
                    .participants().forEach(p->assertThat(p.answeredCount()).isZero()); }
                catch(Exception ex) { throw new RuntimeException(ex); }
                tx.setRollbackOnly();
            });
        }
        attempts.save(f.participant.id(),a.id(),q.id(),new Save(0L,new Answer(List.of(),true,null),false,null));
        monitoringSocket.update();
        String update=null;
        for(int i=0;i<5;i++) { update=listener.messages.poll(5,TimeUnit.SECONDS); if(update!=null && update.contains("PROGRESS")) break; }
        assertThat(update).contains("PROGRESS").doesNotContain("optionIds","correctBoolean","SECRET");
        assertThat(json.readTree(update).path("changes").get(0).path("participant").path("answeredCount").asInt()).isEqualTo(1);
        ws.sendClose(1000,"done").join();
    }

    @Test void concurrentStartReturnsSameAttemptAndKeepsOrderAfterReload() throws Exception {
        var f=fixture(AccessType.PUBLIC,true); open(f);
        var results=parallel(()->attempts.start(f.participant.id(),f.session.id()),()->attempts.start(f.participant.id(),f.session.id()));
        assertThat(results).filteredOn(Started::created).hasSize(1);
        var a=results.getFirst().attempt(); assertThat(results.getLast().attempt().id()).isEqualTo(a.id());
        var resumed=attempts.read(f.participant.id(),a.id());
        assertThat(resumed.questions()).isEqualTo(a.questions());
        assertThat(a.questions()).hasSize(4);
        assertThat(a.deadline()).isEqualTo(a.startedAt().plusSeconds(600));
        assertThat(jdbc.queryForObject("select count(*) from attempts where session_id=?",Integer.class,f.session.id())).isEqualTo(1);
    }
    @Test void noShuffleUsesPublishedOrderAndSnapshotDoesNotFollowBankChanges() {
        var f=fixture(AccessType.PUBLIC,false); open(f); var a=start(f);
        var original=exams.takingQuestions(a.examVersionId());
        assertThat(a.questions().stream().map(Question::id).toList()).isEqualTo(original.stream().map(ExamService.TakingQuestion::id).toList());
        for (int i=0;i<4;i++) assertThat(a.questions().get(i).options().stream().map(Option::id).toList()).isEqualTo(original.get(i).options().stream().map(ExamService.TakingOption::id).toList());
        jdbc.update("update questions set content='Changed bank' where owner_id=?",f.owner.id());
        assertThat(attempts.read(f.participant.id(),a.id()).questions()).isEqualTo(a.questions());
    }
    @Test void allAnswerTypesReviewClearAndTelemetryRoundTrip() {
        var f=fixture(AccessType.PUBLIC,true); open(f); var a=start(f); clock.time=clock.time.plusSeconds(20);
        for(var q:a.questions()) {
            var answer=switch(q.type()) {
                case "SINGLE_CHOICE" -> new Answer(List.of(q.options().getFirst().id()),null,null);
                case "MULTIPLE_CHOICE" -> new Answer(q.options().stream().map(Option::id).toList(),null,null);
                case "TRUE_FALSE" -> new Answer(List.of(),false,null);
                default -> new Answer(List.of(),null,"-12.1234567890");
            };
            var saved=attempts.save(f.participant.id(),a.id(),q.id(),new Save(0L,answer,true,999999L));
            assertThat(saved.state().answer()).isEqualTo(answer); assertThat(saved.state().activeTimeMs()).isEqualTo(20000L);
            var resumed=attempts.read(f.participant.id(),a.id()).questions().stream().filter(v->v.id().equals(q.id())).findFirst().orElseThrow();
            assertThat(resumed.state()).isEqualTo(saved.state());
            var clear=attempts.save(f.participant.id(),a.id(),q.id(),new Save(1L,Answer.empty(),false,1000L));
            assertThat(clear.state().activeTimeMs()).isEqualTo(20000L); assertThat(clear.state().answer()).isEqualTo(Answer.empty());
        }
    }
    @Test void concurrentSameQuestionConflictsButDifferentQuestionsDoNot() throws Exception {
        var f=fixture(AccessType.PUBLIC,false); open(f); var a=start(f); var q=a.questions().getFirst();
        var responses=parallel(()->saveOutcome(f,a,q),()->saveOutcome(f,a,q));
        assertThat(responses).containsExactlyInAnyOrder("saved","ANSWER_REVISION_CONFLICT");
        var result=parallel(()->attempts.save(f.participant.id(),a.id(),a.questions().get(1).id(),new Save(0L,Answer.empty(),true,null)),
                ()->attempts.save(f.participant.id(),a.id(),a.questions().get(2).id(),new Save(0L,Answer.empty(),true,null)));
        assertThat(result).allMatch(s->s.state().revision()==1);
    }
    private String saveOutcome(Fixture f,View a,Question q) {
        try { attempts.save(f.participant.id(),a.id(),q.id(),new Save(0L,Answer.empty(),true,null)); return "saved"; }
        catch(com.learnova.attempt.exception.AttemptFailure ex) { return ex.code; }
    }
    @Test void maxAttemptsDeadlineAndExtensionRemainAuthoritative() {
        var f=fixture(AccessType.PUBLIC,false); open(f); var a=start(f);
        clock.time=a.deadline();
        assertThatThrownBy(()->attempts.save(f.participant.id(),a.id(),a.questions().getFirst().id(),new Save(0L,Answer.empty(),true,null))).hasMessage("ATTEMPT_DEADLINE_PASSED");
        assertThat(attempts.read(f.participant.id(),a.id()).status()).isEqualTo("GRADED");
        assertThat(attempts.read(f.participant.id(),a.id()).questions()).isEmpty();
        jdbc.update("update exam_sessions set end_time=end_time+interval '1 hour' where id=?",f.session.id());
        assertThat(attempts.read(f.participant.id(),a.id()).deadline()).isEqualTo(a.deadline());
        var second=start(f); attempts.submit(f.participant.id(),second.id());
        jdbc.update("update exam_sessions set first_attempt_at=null where id=?",f.session.id());
        assertThatThrownBy(()->attempts.start(f.participant.id(),f.session.id())).hasMessage("ATTEMPTS_EXHAUSTED");
        assertThat(jdbc.queryForObject("select first_attempt_at from exam_sessions where id=?",Instant.class,f.session.id())).isNull();
        assertThat(jdbc.queryForObject("select count(*) from attempts where session_id=?",Integer.class,f.session.id())).isEqualTo(2);
    }
    @Test void sessionEndCapsDeadlineAndExactEndRejectsStart() {
        var f=fixture(AccessType.PUBLIC,false); clock.time=f.session.endTime().minusSeconds(3); var a=start(f);
        assertThat(a.deadline()).isEqualTo(f.session.endTime()); clock.time=f.session.endTime();
        var other=user("PARTICIPANT");
        assertThatThrownBy(()->attempts.start(other.id(),f.session.id())).hasMessage("SESSION_INVALID_STATE");
    }
    @Test void removalPreservesResumeAndSaveButRejectsNewStart() {
        var f=fixture(AccessType.CLASS,false); open(f); var a=start(f);
        classes.remove(f.owner.id(),f.classroom,f.participant.id());
        assertThat(attempts.start(f.participant.id(),f.session.id()).attempt().id()).isEqualTo(a.id());
        assertThat(attempts.read(f.participant.id(),a.id()).canEdit()).isTrue();
        attempts.save(f.participant.id(),a.id(),a.questions().getFirst().id(),new Save(0L,Answer.empty(),true,null));
        jdbc.update("update attempts set status='GRADED' where id=?",a.id());
        assertThatThrownBy(()->attempts.start(f.participant.id(),f.session.id())).hasMessage("SESSION_NOT_ASSIGNED");
    }
    @Test void failedAdmissionRollsBackFirstAttemptMarkerAndCancelCannotRaceStart() throws Exception {
        var f=fixture(AccessType.INDIVIDUAL,false); open(f);
        assertThatThrownBy(()->attempts.start(user("PARTICIPANT").id(),f.session.id())).hasMessage("SESSION_NOT_ASSIGNED");
        assertThat(jdbc.queryForObject("select first_attempt_at from exam_sessions where id=?",Instant.class,f.session.id())).isNull();
        var result=parallel(()->{ try { start(f); return "started"; } catch(RuntimeException ex) { return ex.getMessage(); } },
                ()->{ try { sessions.cancel(f.owner.id(),f.session.id(),f.session.revision()); return "cancelled"; } catch(RuntimeException ex) { return ex.getMessage(); } });
        assertThat(result).contains("started").doesNotContain("cancelled");
    }
    @Test void authorizationValidationAndNoGradingDataOnHttpResponses() throws Exception {
        var f=fixture(AccessType.PUBLIC,false); open(f);
        String start="/api/v1/exam-sessions/"+f.session.id()+"/attempts";
        mvc.perform(post(start)).andExpect(status().isUnauthorized());
        mvc.perform(post(start).with(as(f.owner))).andExpect(status().isForbidden());
        var body=mvc.perform(post(start).with(as(f.participant))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("SECRET EXPLANATION","correct","tolerance","difficulty","snapshot","points");
        var a=json.readValue(body,View.class); String url="/api/v1/attempts/"+a.id();
        mvc.perform(get(url).with(as(user("PARTICIPANT")))).andExpect(status().isNotFound());
        var q=a.questions().getFirst(); String save=url+"/answers/"+q.id();
        mvc.perform(put(save).with(as(f.participant)).contentType("application/json").content(json.writeValueAsString(new Save(0L,new Answer(List.of(UUID.randomUUID()),null,null),false,null))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_ATTEMPT_ANSWER"));
        mvc.perform(put(save).with(as(f.participant)).contentType("application/json").content("{\"revision\":0,\"answer\":{\"optionIds\":[],\"correct\":true},\"markedForReview\":false}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put(save).with(as(f.participant)).contentType("application/json").content("{\"revision\":0,\"answer\":{\"optionIds\":null},\"markedForReview\":false}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put(save).with(as(f.participant)).contentType("application/json").content("{\"revision\":0.5,\"answer\":{\"optionIds\":[]},\"markedForReview\":false}"))
                .andExpect(status().isBadRequest());
        jdbc.update("update users set status='LOCKED' where id=?",f.participant.id());
        mvc.perform(get(url).with(as(f.participant))).andExpect(status().isForbidden());
    }
    @Test void invalidAnswerShapesAndNumericPrecisionAreRejected() {
        var f=fixture(AccessType.PUBLIC,false); open(f); var a=start(f);
        var numeric=a.questions().stream().filter(q->q.type().equals("NUMERIC_ANSWER")).findFirst().orElseThrow();
        for(String value:List.of("1e3","NaN","1.12345678901","123456789012345678901","-",""))
            assertThatThrownBy(()->attempts.save(f.participant.id(),a.id(),numeric.id(),new Save(0L,new Answer(List.of(),null,value),false,null))).hasMessage("INVALID_ATTEMPT_ANSWER");
        var q=a.questions().getFirst();
        assertThatThrownBy(()->attempts.save(f.participant.id(),a.id(),q.id(),new Save(0L,new Answer(q.options().stream().map(Option::id).toList(),null,null),false,null))).hasMessage("INVALID_ATTEMPT_ANSWER");
        assertThatThrownBy(()->attempts.save(f.participant.id(),a.id(),UUID.randomUUID(),new Save(0L,Answer.empty(),false,null))).hasMessage("ATTEMPT_QUESTION_NOT_FOUND");
    }
    @Test void migrationFromV10BackfillsOrderWithoutInventingAnswers() {
        String schema="attempt_upgrade_"+UUID.randomUUID().toString().replace("-","");
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("10").load().migrate();
        var f=fixture(AccessType.PUBLIC,true); open(f); var a=start(f);
        for (String table:List.of("users","exams","exam_versions","exam_version_questions","exam_sessions")) {
            String columns=String.join(",",jdbc.queryForList("select column_name from information_schema.columns where table_schema=? and table_name=? order by ordinal_position",String.class,schema,table));
            jdbc.update("insert into "+schema+"."+table+" ("+columns+") select "+columns+" from public."+table);
        }
        jdbc.update("insert into "+schema+".attempts select id,participant_id,session_id,exam_version_id,attempt_number,status,started_at,deadline,submitted_at,revision from public.attempts");
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
        assertThat(jdbc.queryForObject("select count(*) from "+schema+".attempt_answers where attempt_id=?",Integer.class,a.id())).isEqualTo(4);
        assertThat(jdbc.queryForObject("select count(*) from "+schema+".attempt_answers where saved_at is not null or active_time_ms is not null or revision<>0",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select deadline from "+schema+".attempts where id=?",java.sql.Timestamp.class,a.id()).toInstant()).isEqualTo(a.deadline());
    }
    @Test void doubleSubmitGradesSnapshotOnceAndNeverDisclosesResult() throws Exception {
        var f=fixture(AccessType.PUBLIC,true); open(f); var a=start(f);
        for (var q:exams.gradingQuestions(a.examVersionId())) {
            var answer=new Answer(new ArrayList<>(q.correctOptions()),q.correctBoolean(),q.correctValue()==null?null:q.correctValue().toPlainString());
            attempts.save(f.participant.id(),a.id(),q.id(),new Save(0L,answer,false,null));
        }
        jdbc.update("update questions set content='Changed bank' where owner_id=?",f.owner.id());
        var results=parallel(()->attempts.submit(f.participant.id(),a.id()),()->attempts.submit(f.participant.id(),a.id()));
        assertThat(results.getFirst()).isEqualTo(results.getLast());
        assertThat(results).allMatch(v->v.status().equals("GRADED") && v.completionReason().equals("PARTICIPANT_SUBMIT") && !v.canEdit() && v.questions().isEmpty());
        assertThat(jdbc.queryForObject("select count(*) from attempt_results where attempt_id=?",Integer.class,a.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select raw_score from attempt_results where attempt_id=?",java.math.BigDecimal.class,a.id())).isEqualByComparingTo("4");
        assertThat(jdbc.queryForObject("select count(*) from attempt_result_questions where attempt_id=? and correct",Integer.class,a.id())).isEqualTo(4);
        assertThatThrownBy(()->attempts.save(f.participant.id(),a.id(),a.questions().getFirst().id(),new Save(1L,Answer.empty(),false,null))).hasMessage("ATTEMPT_NOT_EDITABLE");
        var body=mvc.perform(post("/api/v1/attempts/"+a.id()+"/submit").with(as(f.participant))).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("rawScore","passed","points","correct","tolerance","SECRET EXPLANATION");
    }
    @Test void submitVersusExpirationUsesPersistedDeadlineExactlyOnce() throws Exception {
        var f=fixture(AccessType.PUBLIC,false); open(f); var a=start(f); clock.time=a.deadline();
        parallel(()->{ attempts.submit(f.participant.id(),a.id()); return true; },()->{ finalization.expire(a.id()); return true; });
        var completed=attempts.read(f.participant.id(),a.id());
        assertThat(completed.completionReason()).isEqualTo("DEADLINE_REACHED");
        assertThat(completed.submittedAt()).isEqualTo(a.deadline());
        assertThat(jdbc.queryForObject("select count(*) from attempt_results where attempt_id=?",Integer.class,a.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select raw_score from attempt_results where attempt_id=?",java.math.BigDecimal.class,a.id())).isEqualByComparingTo("0");
    }
    @Test void saveVersusSubmitProducesAConsistentImmutableScore() throws Exception {
        var f=fixture(AccessType.PUBLIC,false); open(f); var a=start(f);
        var q=a.questions().stream().filter(v->v.type().equals("TRUE_FALSE")).findFirst().orElseThrow();
        var outcomes=parallel(()->{
            try { attempts.save(f.participant.id(),a.id(),q.id(),new Save(0L,new Answer(List.of(),true,null),false,null)); return "saved"; }
            catch(com.learnova.attempt.exception.AttemptFailure ex) { return ex.code; }
        },()->{ attempts.submit(f.participant.id(),a.id()); return "submitted"; });
        assertThat(outcomes.getFirst()).isIn("saved","ATTEMPT_NOT_EDITABLE");
        assertThat(jdbc.queryForObject("select raw_score from attempt_results where attempt_id=?",java.math.BigDecimal.class,a.id()))
                .isEqualByComparingTo(outcomes.getFirst().equals("saved")?"1":"0");
        assertThat(jdbc.queryForObject("select count(*) from attempt_results where attempt_id=?",Integer.class,a.id())).isEqualTo(1);
    }
    @Test void schedulerRecoversOverdueAttemptsWithoutBrowserOrMembershipAndCanRunConcurrently() throws Exception {
        var f=fixture(AccessType.CLASS,false); open(f); var a=start(f);
        classes.remove(f.owner.id(),f.classroom,f.participant.id());
        jdbc.update("update users set status='LOCKED' where id=?",f.participant.id());
        clock.time=a.deadline().plusSeconds(120);
        parallel(()->{ scheduler.run(); return true; },()->{ scheduler.run(); return true; });
        assertThat(jdbc.queryForObject("select status from attempts where id=?",String.class,a.id())).isEqualTo("GRADED");
        assertThat(jdbc.queryForObject("select submitted_at from attempts where id=?",java.sql.Timestamp.class,a.id()).toInstant()).isEqualTo(a.deadline());
        assertThat(jdbc.queryForObject("select count(*) from attempt_results where attempt_id=?",Integer.class,a.id())).isEqualTo(1);
    }
    @Test void failedGradingRollsBackEverythingAndSchedulerContinuesThenRetries() {
        var f=fixture(AccessType.PUBLIC,false); open(f); var a=start(f);
        String constraint="fail_grade_"+UUID.randomUUID().toString().replace("-","");
        jdbc.execute("alter table attempt_result_questions add constraint "+constraint+" check (attempt_id <> '"+a.id()+"'::uuid)");
        try {
            assertThatThrownBy(()->attempts.submit(f.participant.id(),a.id())).isInstanceOf(org.springframework.dao.DataAccessException.class);
            assertThat(jdbc.queryForObject("select status from attempts where id=?",String.class,a.id())).isEqualTo("IN_PROGRESS");
            assertThat(jdbc.queryForObject("select count(*) from attempt_results where attempt_id=?",Integer.class,a.id())).isZero();
            var other=fixture(AccessType.PUBLIC,false); open(other); var b=start(other);
            clock.time=b.deadline().plusSeconds(1); scheduler.run();
            assertThat(jdbc.queryForObject("select status from attempts where id=?",String.class,b.id())).isEqualTo("GRADED");
            assertThat(jdbc.queryForObject("select status from attempts where id=?",String.class,a.id())).isEqualTo("IN_PROGRESS");
        } finally { jdbc.execute("alter table attempt_result_questions drop constraint "+constraint); }
        scheduler.run();
        assertThat(jdbc.queryForObject("select count(*) from attempt_results where attempt_id=?",Integer.class,a.id())).isEqualTo(1);
    }
    @Test void lazyStartFinalizesExistingAttemptWithoutConsumingAnotherAndLateSaveCommits() {
        var f=fixture(AccessType.PUBLIC,false); open(f); var a=start(f); clock.time=a.deadline();
        var resumed=attempts.start(f.participant.id(),f.session.id());
        assertThat(resumed.created()).isFalse(); assertThat(resumed.attempt().id()).isEqualTo(a.id());
        assertThat(resumed.attempt().status()).isEqualTo("GRADED");
        var b=start(f); clock.time=b.deadline();
        assertThatThrownBy(()->attempts.save(f.participant.id(),b.id(),b.questions().getFirst().id(),new Save(0L,Answer.empty(),false,null))).hasMessage("ATTEMPT_DEADLINE_PASSED");
        assertThat(jdbc.queryForObject("select count(*) from attempt_results where attempt_id=?",Integer.class,b.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select revision from attempt_answers where attempt_id=? and question_id=?",Long.class,b.id(),b.questions().getFirst().id())).isZero();
    }
    @Test void submitRequiresActiveParticipantOwnerButNotCurrentMembership() throws Exception {
        var f=fixture(AccessType.CLASS,false); open(f); var a=start(f); var url="/api/v1/attempts/"+a.id()+"/submit";
        mvc.perform(post(url)).andExpect(status().isUnauthorized());
        mvc.perform(post(url).with(as(f.owner))).andExpect(status().isForbidden());
        mvc.perform(post(url).with(as(user("PARTICIPANT")))).andExpect(status().isNotFound());
        jdbc.update("update users set status='LOCKED' where id=?",f.participant.id());
        mvc.perform(post(url).with(as(f.participant))).andExpect(status().isForbidden());
        jdbc.update("update users set status='ACTIVE' where id=?",f.participant.id());
        classes.remove(f.owner.id(),f.classroom,f.participant.id());
        mvc.perform(post(url).with(as(f.participant))).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("GRADED"));
    }
    @Test void resultMatrixProtectsEveryParticipantProjectionBeforeAndAfterRelease() throws Exception {
        for (var mode:ResultDisplayMode.values()) for (var policy:ResultReleasePolicy.values()) {
            var f=fixture(AccessType.PUBLIC,true); open(f); var a=start(f);
            attempts.submit(f.participant.id(),a.id());
            jdbc.update("update exam_sessions set result_display_mode=?,result_release_policy=? where id=?",mode.name(),policy.name(),f.session.id());
            for (boolean after:List.of(false,true)) {
                if (after && policy==ResultReleasePolicy.AFTER_SESSION_END) clock.time=f.session.endTime();
                if (after && policy==ResultReleasePolicy.MANUAL) sessions.releaseResults(f.owner.id(),f.session.id());
                boolean visible=mode!=ResultDisplayMode.HIDDEN && (policy==ResultReleasePolicy.IMMEDIATE||after);
                var detail=results.detail(f.participant.id(),a.id(),false);
                assertThat(detail.result()!=null).as("%s/%s after=%s",mode,policy,after).isEqualTo(visible);
                assertThat(detail.summary()!=null).isEqualTo(visible&&mode!=ResultDisplayMode.SCORE_ONLY);
                assertThat(detail.questions()!=null).isEqualTo(visible&&mode==ResultDisplayMode.DETAILED);
                var history=results.history(f.participant.id(),new com.learnova.shared.api.PageQuery(0,1)).content().getFirst();
                assertThat(history.bestResult()!=null).isEqualTo(visible);
                assertThat(history.bestAttemptId()!=null).isEqualTo(visible);
                var listed=results.attempts(f.participant.id(),f.session.id(),f.participant.id(),new com.learnova.shared.api.PageQuery(0,1),false).content().getFirst();
                assertThat(listed.result()!=null).isEqualTo(visible);
                String body=mvc.perform(get("/api/v1/participant/results/"+a.id()).with(as(f.participant))).andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control",org.hamcrest.Matchers.containsString("no-store"))).andReturn().getResponse().getContentAsString();
                if (!visible) assertThat(body).doesNotContain("\"result\"","\"summary\"","\"questions\"","SECRET EXPLANATION","\"passed\"");
                else if (mode!=ResultDisplayMode.DETAILED) assertThat(body).doesNotContain("SECRET EXPLANATION","correctBoolean","correctValue");
            }
        }
    }
    @Test void bestScoreKeepsEveryAttemptAndDetailedSnapshotAfterMembershipRemoval() throws Exception {
        var f=fixture(AccessType.CLASS,true); open(f); var first=start(f);
        for (var q:first.questions()) if (q.type().equals("TRUE_FALSE")) attempts.save(f.participant.id(),first.id(),q.id(),new Save(0L,new Answer(List.of(),true,null),false,null));
        clock.time=clock.time.plusSeconds(5); attempts.submit(f.participant.id(),first.id());
        var second=start(f); clock.time=clock.time.plusSeconds(5); attempts.submit(f.participant.id(),second.id());
        jdbc.update("update exam_sessions set result_display_mode='DETAILED',result_release_policy='IMMEDIATE' where id=?",f.session.id());
        classes.remove(f.owner.id(),f.classroom,f.participant.id());
        jdbc.update("update questions set explanation='CHANGED BANK' where owner_id=?",f.owner.id());
        var h=results.history(f.participant.id(),new com.learnova.shared.api.PageQuery(0,1)).content().getFirst();
        assertThat(h.attemptCount()).isEqualTo(2); assertThat(h.bestAttemptId()).isEqualTo(first.id()); assertThat(h.bestResult().score()).isEqualTo("1");
        assertThat(results.attempts(f.participant.id(),f.session.id(),f.participant.id(),new com.learnova.shared.api.PageQuery(0,1),false).totalElements()).isEqualTo(2);
        var detail=results.detail(f.participant.id(),first.id(),false);
        assertThat(detail.summary().correctCount()).isEqualTo(1); assertThat(detail.summary().unansweredCount()).isEqualTo(3);
        assertThat(detail.summary().incorrectCount()).isZero(); assertThat(detail.summary().durationSeconds()).isEqualTo(5);
        assertThat(detail.questions()).allMatch(q->q.explanation().equals("SECRET EXPLANATION"));
        assertThat(detail.questions().stream().map(q->q.id()).toList()).isEqualTo(first.questions().stream().map(Question::id).toList());
        assertThat(results.session(f.owner.id(),f.session.id(),new com.learnova.shared.api.PageQuery(0,20)).participants().content().getFirst().bestAttemptId()).isEqualTo(first.id());
        mvc.perform(get("/api/v1/participant/results/"+first.id()).with(as(user("PARTICIPANT")))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/participant/results/"+first.id()).with(as(f.owner))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/exam-sessions/"+f.session.id()+"/results").with(as(user("CREATOR")))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/participant/results/"+first.id())).andExpect(status().isUnauthorized());
    }
    @Test void manualReleaseIsConcurrentIdempotentAuditedAndHiddenStaysHidden() throws Exception {
        var f=fixture(AccessType.PUBLIC,false); open(f); var a=start(f); attempts.submit(f.participant.id(),a.id());
        jdbc.update("update exam_sessions set result_display_mode='HIDDEN',result_release_policy='MANUAL' where id=?",f.session.id());
        var released=parallel(()->sessions.releaseResults(f.owner.id(),f.session.id()),()->sessions.releaseResults(f.owner.id(),f.session.id()));
        assertThat(released.getFirst()).isEqualTo(released.getLast());
        assertThat(jdbc.queryForObject("select count(*) from audit_records where action='RESULT_MANUALLY_RELEASED' and target_id=?",Integer.class,f.session.id().toString())).isEqualTo(1);
        assertThat(results.detail(f.participant.id(),a.id(),false).result()).isNull();
        assertThat(results.detail(f.owner.id(),a.id(),true).questions()).hasSize(4);
        mvc.perform(post("/api/v1/exam-sessions/"+f.session.id()+"/release-results").with(as(f.owner))).andExpect(status().isOk());
        mvc.perform(post("/api/v1/exam-sessions/"+f.session.id()+"/release-results").with(as(user("CREATOR")))).andExpect(status().isNotFound());
    }
    @Test void extensionMovesReleaseBoundaryAndInProgressNeverExposesGrading() {
        var f=fixture(AccessType.PUBLIC,false); open(f); var a=start(f);
        assertThat(results.detail(f.owner.id(),a.id(),true).questions()).isNull();
        attempts.submit(f.participant.id(),a.id());
        var current=sessions.detail(f.owner.id(),f.session.id());
        var extended=sessions.extend(f.owner.id(),f.session.id(),new Extend(current.revision(),f.session.endTime().plusSeconds(600)));
        clock.time=f.session.endTime(); assertThat(results.detail(f.participant.id(),a.id(),false).result()).isNull();
        clock.time=extended.endTime(); assertThat(results.detail(f.participant.id(),a.id(),false).result()).isNotNull();
        assertThatThrownBy(()->sessions.releaseResults(f.owner.id(),f.session.id())).hasMessage("RESULT_RELEASE_NOT_MANUAL");
    }
    @Test void releaseAuditFailureRollsBackTimestampAndRetrySucceeds() {
        var f=fixture(AccessType.INDIVIDUAL,false);
        jdbc.update("update exam_sessions set result_release_policy='MANUAL' where id=?",f.session.id());
        String constraint="fail_release_"+UUID.randomUUID().toString().replace("-","");
        jdbc.execute("alter table audit_records add constraint "+constraint+" check (action <> 'RESULT_MANUALLY_RELEASED' or target_id <> '"+f.session.id()+"')");
        try {
            assertThatThrownBy(()->sessions.releaseResults(f.owner.id(),f.session.id())).isInstanceOf(RuntimeException.class);
            assertThat(jdbc.queryForObject("select results_released_at from exam_sessions where id=?",java.sql.Timestamp.class,f.session.id())).isNull();
        } finally { jdbc.execute("alter table audit_records drop constraint "+constraint); }
        assertThat(sessions.releaseResults(f.owner.id(),f.session.id()).releasedAt()).isNotNull();
    }
    @Test void creatorIncludesUnstartedAssignmentsAndBestTieIsStableAcrossPages() {
        var f=fixture(AccessType.INDIVIDUAL,false);
        var unstarted=results.session(f.owner.id(),f.session.id(),new com.learnova.shared.api.PageQuery(0,1)).participants();
        assertThat(unstarted.totalElements()).isEqualTo(1); assertThat(unstarted.content().getFirst().attemptCount()).isZero();
        assertThat(unstarted.content().getFirst().bestResult()).isNull();
        open(f); var a=start(f); attempts.submit(f.participant.id(),a.id());
        clock.time=clock.time.plusSeconds(1); var b=start(f); attempts.submit(f.participant.id(),b.id());
        var best=results.session(f.owner.id(),f.session.id(),new com.learnova.shared.api.PageQuery(0,1)).participants().content().getFirst();
        assertThat(best.bestAttemptId()).isEqualTo(a.id()); assertThat(best.bestResult().score()).isEqualTo("0");
        var second=results.attempts(f.owner.id(),f.session.id(),f.participant.id(),new com.learnova.shared.api.PageQuery(1,1),true);
        assertThat(second.content().getFirst().id()).isEqualTo(a.id()); assertThat(second.totalElements()).isEqualTo(2);
        var empty=results.session(f.owner.id(),f.session.id(),new com.learnova.shared.api.PageQuery(1,1)).participants();
        assertThat(empty.content()).isEmpty(); assertThat(empty.totalElements()).isEqualTo(1);
    }
    @Test void reportingUsesBestPerPersonButAllGradedQuestionSamplesAndValidTiming() {
        var f=fixture(AccessType.PUBLIC,false); open(f);
        var a=start(f); clock.time=clock.time.plusSeconds(10);
        var q=a.questions().stream().filter(x->x.type().equals("TRUE_FALSE")).findFirst().orElseThrow();
        attempts.save(f.participant.id(),a.id(),q.id(),new Save(0L,new Answer(List.of(),true,null),false,2000L));
        attempts.submit(f.participant.id(),a.id());
        var b=start(f); clock.time=clock.time.plusSeconds(10);
        attempts.save(f.participant.id(),b.id(),q.id(),new Save(0L,new Answer(List.of(),false,null),false,4000L));
        attempts.submit(f.participant.id(),b.id());
        var p=user("PARTICIPANT"); var c=attempts.start(p.id(),f.session.id()).attempt(); attempts.submit(p.id(),c.id());
        var report=reporting.analytics(f.owner.id(),f.session.id());
        assertThat(report.overview().gradedParticipantCount()).isEqualTo(2);
        assertThat(report.overview().averageScore()).isEqualByComparingTo("0.5");
        assertThat(report.overview().highestScore()).isEqualByComparingTo("1");
        assertThat(report.overview().lowestScore()).isEqualByComparingTo("0");
        assertThat(report.overview().passRate()).isEqualByComparingTo("50");
        assertThat(report.overview().completionRate()).isNull();
        assertThat(report.distribution().stream().mapToLong(x->x.count()).sum()).isEqualTo(2);
        assertThat(report.distribution().get(0).count()).isEqualTo(1);
        assertThat(report.distribution().get(2).count()).isEqualTo(1);
        var question=report.questions().stream().filter(x->x.id().equals(q.id())).findFirst().orElseThrow();
        assertThat(question.sampleCount()).isEqualTo(3);
        assertThat(question.correctCount()).isEqualTo(1); assertThat(question.incorrectCount()).isEqualTo(1);
        assertThat(question.unansweredCount()).isEqualTo(1); assertThat(question.correctRate()).isEqualByComparingTo("33.33");
        assertThat(question.timedSampleCount()).isEqualTo(2); assertThat(question.averageAnswerTimeMs()).isEqualByComparingTo("3000");
        assertThat(report.questions().stream().filter(x->!x.id().equals(q.id())).allMatch(x->x.averageAnswerTimeMs()==null)).isTrue();
        jdbc.update("update attempt_answers set active_time_ms=999999999 where attempt_id=? and question_id=?",b.id(),q.id());
        var valid=reporting.analytics(f.owner.id(),f.session.id()).questions().stream().filter(x->x.id().equals(q.id())).findFirst().orElseThrow();
        assertThat(valid.timedSampleCount()).isEqualTo(1); assertThat(valid.averageAnswerTimeMs()).isEqualByComparingTo("2000");
        jdbc.update("update questions set content='Changed bank' where owner_id=?",f.owner.id());
        assertThat(reporting.analytics(f.owner.id(),f.session.id()).questions()).extracting(x->x.snapshot().content()).doesNotContain("Changed bank");
        var perfect=attempts.start(p.id(),f.session.id()).attempt();
        for(var item:perfect.questions()) {
            var answer=switch(item.type()) {
                case "TRUE_FALSE" -> new Answer(List.of(),true,null);
                case "NUMERIC_ANSWER" -> new Answer(List.of(),null,"2.5");
                default -> new Answer(List.of(item.options().getFirst().id()),null,null);
            };
            attempts.save(p.id(),perfect.id(),item.id(),new Save(0L,answer,false,0L));
        }
        attempts.submit(p.id(),perfect.id());
        var full=reporting.analytics(f.owner.id(),f.session.id());
        assertThat(full.distribution().get(9).count()).isEqualTo(1);
        assertThat(full.distribution().get(9).upperInclusive()).isTrue();
        assertThat(full.overview().highestScore()).isEqualByComparingTo("4");
    }
    @Test void reportingCompletionKeepsRemovedMembersAndZeroDenominators() {
        var f=fixture(AccessType.CLASS,false);
        var empty=reporting.analytics(f.owner.id(),f.session.id());
        assertThat(empty.overview().averageScore()).isNull(); assertThat(empty.overview().passRate()).isNull();
        assertThat(empty.overview().completionRate()).isEqualByComparingTo("0");
        assertThat(empty.questions()).allMatch(q->q.sampleCount()==0&&q.correctRate()==null&&q.averageAnswerTimeMs()==null);
        open(f); var a=start(f); attempts.submit(f.participant.id(),a.id());
        classes.remove(f.owner.id(),f.classroom,f.participant.id());
        classes.add(f.owner.id(),f.classroom,user("PARTICIPANT").id());
        var report=reporting.analytics(f.owner.id(),f.session.id());
        assertThat(report.overview().participantCount()).isEqualTo(2);
        assertThat(report.overview().completionRate()).isEqualByComparingTo("50");
        var zero=fixture(AccessType.CLASS,false); classes.remove(zero.owner.id(),zero.classroom,zero.participant.id());
        assertThat(reporting.analytics(zero.owner.id(),zero.session.id()).overview().completionRate()).isNull();
        var individual=fixture(AccessType.INDIVIDUAL,false); open(individual); var done=start(individual);
        attempts.submit(individual.participant.id(),done.id());
        assertThat(reporting.analytics(individual.owner.id(),individual.session.id()).overview().completionRate()).isEqualByComparingTo("100");
    }
    @Test void reportingExportIncludesEveryAttemptTypedTextAndUngradedBlanks() throws Exception {
        var f=fixture(AccessType.PUBLIC,false); open(f);
        jdbc.update("update users set display_name='=1+1' where id=?",f.participant.id());
        var a=start(f); attempts.submit(f.participant.id(),a.id()); start(f);
        var bytes=reporting.export(f.owner.id(),f.session.id());
        try(var workbook=new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(bytes))) {
            var sheet=workbook.getSheetAt(0); assertThat(sheet.getLastRowNum()).isEqualTo(2);
            assertThat(sheet.getRow(0).getLastCellNum()).isEqualTo((short)13);
            assertThat(sheet.getRow(1).getCell(0).getCellType()).isEqualTo(org.apache.poi.ss.usermodel.CellType.STRING);
            assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEqualTo("=1+1");
            assertThat(sheet.getRow(1).getCell(3).getNumericCellValue()).isZero();
            assertThat(sheet.getRow(1).getCell(7).getNumericCellValue()).isEqualTo(4);
            assertThat(sheet.getRow(1).getCell(11).getStringCellValue()).isEqualTo("FAIL");
            assertThat(sheet.getRow(2).getCell(3).getNumericCellValue()).isZero();
            assertThat(sheet.getRow(2).getCell(4)).isNull(); assertThat(sheet.getRow(2).getCell(7)).isNull();
            assertThat(sheet.getRow(2).getCell(9)).isNull(); assertThat(sheet.getRow(2).getCell(11)).isNull();
        }
        var http=mvc.perform(get("/api/v1/exam-sessions/"+f.session.id()+"/export?page=50&size=1").with(as(f.owner)))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).andReturn();
        try(var workbook=new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(http.getResponse().getContentAsByteArray()))) {
            assertThat(workbook.getSheetAt(0).getLastRowNum()).isEqualTo(2);
        }
    }
    @Test void reportingHttpRequiresActiveOwnerCreatorEvenWhenResultsAreHidden() throws Exception {
        var f=fixture(AccessType.PUBLIC,false);
        jdbc.update("update exam_sessions set result_display_mode='HIDDEN' where id=?",f.session.id());
        var foreign=user("CREATOR");
        for(String endpoint:List.of("analytics","export")) {
            String path="/api/v1/exam-sessions/"+f.session.id()+"/"+endpoint;
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).with(as(f.participant))).andExpect(status().isForbidden());
            mvc.perform(get(path).with(as(foreign))).andExpect(status().isNotFound());
            mvc.perform(get(path).with(as(f.owner))).andExpect(status().isOk());
        }
        jdbc.update("update users set status='LOCKED' where id=?",f.owner.id());
        for(String endpoint:List.of("analytics","export"))
            mvc.perform(get("/api/v1/exam-sessions/"+f.session.id()+"/"+endpoint).with(as(f.owner))).andExpect(status().isForbidden());
    }
    private Fixture fixture(AccessType access,boolean shuffle) {
        var owner=user("CREATOR"); var p=user("PARTICIPANT"); UUID classroom=null;
        if(access==AccessType.CLASS) { classroom=classes.create(owner.id(),new WriteClassroom("Class",null)).id(); classes.add(owner.id(),classroom,p.id()); }
        var e=exams.create(owner.id(),new CreateExam("Attempt exam",null)); var sources=new ArrayList<Source>();
        for(var type:QuestionType.values()) {
            boolean choice=type==QuestionType.SINGLE_CHOICE || type==QuestionType.MULTIPLE_CHOICE;
            var options=choice?List.of(new QuestionDtos.Option("First",true),new QuestionDtos.Option("Second",false),new QuestionDtos.Option("Third",false)):List.<QuestionDtos.Option>of();
            var q=questions.create(owner.id(),new QuestionDtos.WriteQuestion(type,QuestionStatus.ACTIVE,"Question "+type,"SECRET EXPLANATION",Difficulty.EASY,null,List.of(),options,type==QuestionType.TRUE_FALSE?true:null,type==QuestionType.NUMERIC_ANSWER?"2.5":null,null,null));
            sources.add(new Source(q.id(),q.revision()));
        }
        var v=exams.add(owner.id(),e.versions().getFirst().id(),new AddQuestions(0L,sources)); v=exams.publish(owner.id(),v.id(),v.revision());
        var s=sessions.create(owner.id(),new WriteSession(null,"Attempt exam",v.id(),clock.time.plusSeconds(60),clock.time.plusSeconds(3660),10,2,"1",access,
                classroom==null?List.of():List.of(classroom),access==AccessType.INDIVIDUAL?List.of(p.id()):List.of(),shuffle,shuffle,null,null));
        return new Fixture(owner,p,sessions.schedule(owner.id(),s.id(),s.revision()),classroom);
    }
    private void open(Fixture f) { clock.time=f.session.startTime(); }
    private View start(Fixture f) { return attempts.start(f.participant.id(),f.session.id()).attempt(); }
    private AuthDtos.UserSummary user(String... roles) { return identity.register(new AuthDtos.RegisterRequest(UUID.randomUUID()+"@example.com","Attempt test password 123","Tester",List.of(roles))); }
    private RequestPostProcessor as(AuthDtos.UserSummary user) { String token=tokens.issue(user,UUID.randomUUID().toString()).accessToken(); return r->{r.addHeader("Authorization","Bearer "+token);return r;}; }
    private <T> List<T> parallel(Supplier<T> first,Supplier<T> second) throws Exception {
        try(var executor=Executors.newFixedThreadPool(2)) {
            var ready=new CountDownLatch(2); var go=new CountDownLatch(1);
            var tasks=List.of(first,second).stream().map(action->executor.submit(()->{ ready.countDown(); go.await(); return action.get(); })).toList();
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue(); go.countDown();
            return List.of(tasks.getFirst().get(30,TimeUnit.SECONDS),tasks.getLast().get(30,TimeUnit.SECONDS));
        }
    }
}
