package com.learnova.notification;

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

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"learnova.notification.delay-ms=3600000","learnova.session.lifecycle-delay-ms=3600000","learnova.attempt.finalization-delay-ms=3600000"})
@AutoConfigureMockMvc(print=org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
@Import({TestcontainersConfiguration.class, NotificationIntegrationTests.TimeConfig.class})
class NotificationIntegrationTests {
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
    @Autowired org.springframework.transaction.PlatformTransactionManager transactionManager;
    @BeforeEach void time() { clock.time=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS); }
    record Fixture(AuthDtos.UserSummary owner,AuthDtos.UserSummary participant,Detail session,UUID classroom) {}

    @Autowired com.learnova.notification.service.NotificationService notifications;
    @Autowired com.learnova.notification.service.NotificationDeliveryService delivery;
    private static final com.learnova.shared.api.PageQuery PAGE = new com.learnova.shared.api.PageQuery(0,100);

    @Test void ownerIsolationPaginationAndReadCommandsAreIdempotent() throws Exception {
        var f=fixture(AccessType.CLASS,false); var other=user("PARTICIPANT");
        var list=notifications.list(f.participant.id(),false,PAGE);
        assertThat(list.content()).hasSize(2);
        assertThat(notifications.list(f.participant.id(),false,new com.learnova.shared.api.PageQuery(0,1)).totalPages()).isEqualTo(2);
        var id=list.content().getFirst().id();
        mvc.perform(post("/api/v1/notifications/"+id+"/read").with(as(other))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/notifications").with(as(other))).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(post("/api/v1/notifications/"+id+"/read").with(as(f.participant))).andExpect(status().isNoContent());
        var readAt=notifications.list(f.participant.id(),false,PAGE).content().getFirst().readAt();
        clock.time=clock.time.plusSeconds(1); notifications.read(f.participant.id(),id);
        assertThat(notifications.list(f.participant.id(),false,PAGE).content().getFirst().readAt()).isEqualTo(readAt);
        assertThat(notifications.list(f.participant.id(),true,PAGE).totalElements()).isEqualTo(1);
        mvc.perform(get("/api/v1/notifications/unread-count").with(as(f.participant))).andExpect(jsonPath("$.unreadCount").value(1));
        mvc.perform(post("/api/v1/notifications/read-all").with(as(f.participant))).andExpect(status().isNoContent());
        notifications.readAll(f.participant.id());
        assertThat(notifications.unread(f.participant.id()).unreadCount()).isZero();
        assertThat(notifications.unread(f.owner.id()).unreadCount()).isEqualTo(1);
        for(String q:List.of("?page=-1","?size=101","?unreadOnly=bad"))
            mvc.perform(get("/api/v1/notifications"+q).with(as(f.participant))).andExpect(status().isBadRequest());
    }
    @Test void currentAccountAndRolesAreRequired() throws Exception {
        var p=user("PARTICIPANT"); var token=as(p);
        mvc.perform(get("/api/v1/notifications")).andExpect(status().isUnauthorized());
        jdbc.update("update user_roles set role='ADMIN' where user_id=?",p.id());
        mvc.perform(get("/api/v1/notifications").with(token)).andExpect(status().isForbidden());
        jdbc.update("update user_roles set role='PARTICIPANT' where user_id=?",p.id());
        jdbc.update("update users set status='LOCKED' where id=?",p.id());
        mvc.perform(post("/api/v1/notifications/read-all").with(token)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));
    }
    @Test void draftDoesNotNotifyScheduleAndRetryDo() {
        var f=fixture(AccessType.INDIVIDUAL,false);
        assertThat(count(f.participant,"EXAM_ASSIGNED")).isEqualTo(1);
        delivery.reconcile(); delivery.reconcile();
        assertThat(count(f.participant,"EXAM_ASSIGNED")).isEqualTo(1);
        var d=sessions.create(f.owner.id(),new WriteSession(null,"Draft",f.session.examVersionId(),clock.time.plusSeconds(90),clock.time.plusSeconds(4000),10,2,"1",AccessType.INDIVIDUAL,List.of(),List.of(f.participant.id()),false,false,null,null));
        delivery.reconcile(); assertThat(count(f.participant,"EXAM_ASSIGNED")).isEqualTo(1);
        sessions.schedule(f.owner.id(),d.id(),d.revision()); assertThat(count(f.participant,"EXAM_ASSIGNED")).isEqualTo(2);
    }
    @Test void newMembersAndMultipleClassesDoNotDuplicateAssignment() {
        var f=fixture(AccessType.CLASS,false); var p=user("PARTICIPANT");
        classes.add(f.owner.id(),f.classroom,p.id()); classes.add(f.owner.id(),f.classroom,p.id());
        assertThat(count(p,"EXAM_ASSIGNED")).isEqualTo(1); assertThat(count(p,"CLASS_JOINED")).isEqualTo(1);
        var second=classes.create(f.owner.id(),new WriteClassroom("Second",null)); classes.add(f.owner.id(),second.id(),p.id());
        var s=sessions.detail(f.owner.id(),f.session.id());
        sessions.update(f.owner.id(),s.id(),new WriteSession(s.revision(),s.title(),s.examVersionId(),s.startTime(),s.endTime(),s.durationMinutes(),s.maxAttempts(),s.passingScore(),AccessType.CLASS,List.of(f.classroom,second.id()),List.of(),false,false,s.resultDisplayMode(),s.resultReleasePolicy()));
        delivery.reconcile(); assertThat(count(p,"EXAM_ASSIGNED")).isEqualTo(1);
        classes.remove(f.owner.id(),f.classroom,p.id()); clock.time=clock.time.plusSeconds(1); classes.add(f.owner.id(),f.classroom,p.id());
        assertThat(count(p,"CLASS_JOINED")).isEqualTo(3); assertThat(count(p,"EXAM_ASSIGNED")).isEqualTo(1);
    }
    @Test void rollbackLeavesNeitherMembershipNorAssignmentNotifications() {
        var f=fixture(AccessType.CLASS,false); var p=user("PARTICIPANT");
        new org.springframework.transaction.support.TransactionTemplate(transactionManager).executeWithoutResult(tx->{
            classes.add(f.owner.id(),f.classroom,p.id());
            assertThat(notifications.list(p.id(),false,PAGE).totalElements()).isEqualTo(2); tx.setRollbackOnly();
        });
        delivery.reconcile(); assertThat(notifications.list(p.id(),false,PAGE).totalElements()).isZero();
        var d=sessions.create(f.owner.id(),new WriteSession(null,"Rollback",f.session.examVersionId(),clock.time.plusSeconds(90),clock.time.plusSeconds(4000),10,2,"1",AccessType.INDIVIDUAL,List.of(),List.of(p.id()),false,false,null,null));
        new org.springframework.transaction.support.TransactionTemplate(transactionManager).executeWithoutResult(tx->{sessions.schedule(f.owner.id(),d.id(),d.revision());tx.setRollbackOnly();});
        delivery.reconcile(); assertThat(notifications.list(p.id(),false,PAGE).totalElements()).isZero();
    }
    @Test void reminderUses24HourBoundaryAndNeverCatchesUpLateAssignments() {
        var f=fixture(AccessType.INDIVIDUAL,false); var initial=clock.time;
        var start=initial.plus(Duration.ofHours(25));
        jdbc.update("update exam_sessions set start_time=?,end_time=? where id=?",java.sql.Timestamp.from(start),java.sql.Timestamp.from(start.plusSeconds(3600)),f.session.id());
        clock.time=start.minus(Duration.ofHours(24)).minusSeconds(1); delivery.reconcile();
        assertThat(count(f.participant,"EXAM_REMINDER")).isZero();
        clock.time=clock.time.plusSeconds(1); delivery.reconcile(); delivery.reconcile();
        assertThat(count(f.participant,"EXAM_REMINDER")).isEqualTo(1);
        var late=fixture(AccessType.INDIVIDUAL,false); delivery.reconcile();
        assertThat(count(late.participant,"EXAM_REMINDER")).isZero();
        var lateMember=user("PARTICIPANT");
        jdbc.update("insert into session_individual_assignments values (?,?)",f.session.id(),lateMember.id());
        delivery.reconcile(); assertThat(count(lateMember,"EXAM_ASSIGNED")).isEqualTo(1);
        assertThat(count(lateMember,"EXAM_REMINDER")).isZero();
    }
    @Test void publicCancelledRemovedAndLockedRecipientsDoNotReceiveReminders() {
        var pub=fixture(AccessType.PUBLIC,false); delivery.reconcile();
        assertThat(notifications.list(pub.participant.id(),false,PAGE).content()).isEmpty();
        for(String reason:List.of("cancel","remove","lock")) {
            var f=fixture(AccessType.CLASS,false); var start=clock.time.plus(Duration.ofHours(25));
            jdbc.update("update exam_sessions set start_time=?,end_time=? where id=?",java.sql.Timestamp.from(start),java.sql.Timestamp.from(start.plusSeconds(3600)),f.session.id());
            if(reason.equals("cancel")) sessions.cancel(f.owner.id(),f.session.id(),sessions.detail(f.owner.id(),f.session.id()).revision());
            if(reason.equals("remove")) classes.remove(f.owner.id(),f.classroom,f.participant.id());
            if(reason.equals("lock")) jdbc.update("update users set status='LOCKED' where id=?",f.participant.id());
            clock.time=start.minusSeconds(10); delivery.reconcile();
            assertThat(jdbc.queryForObject("select count(*) from notifications where recipient_id=? and type='EXAM_REMINDER'",Long.class,f.participant.id())).isZero();
        }
    }
    @Test void resultPolicyMatrixMatchesAvailabilityAndPayloadHasNoAnswers() throws Exception {
        for(var mode:ResultDisplayMode.values()) for(var policy:ResultReleasePolicy.values()) {
            var f=fixture(AccessType.PUBLIC,false);
            jdbc.update("update exam_sessions set result_display_mode=?,result_release_policy=? where id=?",mode.name(),policy.name(),f.session.id());
            open(f); var a=start(f); delivery.reconcile(); assertThat(count(f.participant,"RESULT_RELEASED")).isZero();
            attempts.submit(f.participant.id(),a.id()); delivery.reconcile();
            boolean immediate=mode!=ResultDisplayMode.HIDDEN && policy==ResultReleasePolicy.IMMEDIATE;
            assertThat(count(f.participant,"RESULT_RELEASED")).isEqualTo(immediate?1:0);
            if(policy==ResultReleasePolicy.MANUAL) sessions.releaseResults(f.owner.id(),f.session.id());
            clock.time=f.session.endTime(); delivery.reconcile(); delivery.reconcile();
            assertThat(count(f.participant,"RESULT_RELEASED")).isEqualTo(mode==ResultDisplayMode.HIDDEN?0:1);
            var list=notifications.list(f.participant.id(),false,PAGE);
            assertThat(json.writeValueAsString(list)).doesNotContain("SECRET", "rawScore", "correctBoolean", "passingScore");
            if(mode!=ResultDisplayMode.HIDDEN) {
                assertThat(list.content().getFirst().targetPath()).isEqualTo("/participant/results/"+a.id());
                assertThat(results.detail(f.participant.id(),a.id(),false).availability()).isEqualTo("AVAILABLE");
            }
        }
    }
    @Test void concurrentJobsDoNotDuplicateNotifications() throws Exception {
        var f=fixture(AccessType.INDIVIDUAL,false); open(f); var a=start(f); attempts.submit(f.participant.id(),a.id()); clock.time=f.session.endTime();
        parallel(()->{delivery.reconcile();return true;},()->{delivery.reconcile();return true;});
        assertThat(count(f.participant,"RESULT_RELEASED")).isEqualTo(1);
    }
    private long count(AuthDtos.UserSummary user,String type) {
        return notifications.list(user.id(),false,PAGE).content().stream().filter(n->n.type().equals(type)).count();
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
