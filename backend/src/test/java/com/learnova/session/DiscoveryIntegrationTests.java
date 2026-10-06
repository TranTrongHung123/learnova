package com.learnova.session;

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
import com.learnova.session.dto.DiscoveryDtos.Tab;
import com.learnova.session.dto.SessionDtos.*;
import com.learnova.session.enums.*;
import com.learnova.session.service.*;
import com.learnova.shared.api.PageQuery;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="learnova.session.lifecycle-delay-ms=3600000")
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, DiscoveryIntegrationTests.TimeConfig.class})
class DiscoveryIntegrationTests {
    static class MutableClock extends Clock {
        Instant time=Instant.now();
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return time; }
    }
    @TestConfiguration static class TimeConfig { @Bean @Primary MutableClock discoveryClock() { return new MutableClock(); } }
    @Autowired MutableClock clock;
    @Autowired DiscoveryService discovery;
    @Autowired SessionService sessions;
    @Autowired ExamService exams;
    @Autowired ClassroomService classes;
    @Autowired QuestionService questions;
    @Autowired IdentityService identity;
    @Autowired AccessTokens tokens;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired javax.sql.DataSource dataSource;
    final PageQuery page=new PageQuery(0,100);
    final List<UUID> createdSessions=new ArrayList<>();
    @BeforeEach void time() { clock.time=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS); }
    @AfterEach void cleanSessions() {
        for (UUID id:createdSessions) {
            jdbc.update("delete from attempts where session_id=?",id);
            jdbc.update("delete from session_class_assignments where session_id=?",id);
            jdbc.update("delete from session_individual_assignments where session_id=?",id);
            jdbc.update("delete from exam_sessions where id=?",id);
        }
    }

    @Test void boundariesAndOverlappingTabsUseRealAttempts() {
        var owner=user("CREATOR"); var p=user("PARTICIPANT"); var s=session(owner,p,AccessType.INDIVIDUAL,List.of());
        assertThat(discovery.list(p.id(),Tab.UPCOMING,page).content()).extracting(v->v.id()).containsExactly(s.id());
        assertThat(discovery.list(p.id(),Tab.AVAILABLE,page).content()).isEmpty();
        clock.time=s.startTime();
        assertThat(discovery.detail(p.id(),s.id()).canStart()).isTrue();
        seed(p,s,1,"SUBMITTED",clock.time.plusSeconds(300));
        assertThat(discovery.list(p.id(),Tab.COMPLETED,page).content()).hasSize(1);
        assertThat(discovery.list(p.id(),Tab.AVAILABLE,page).content()).hasSize(1);
        seed(p,s,2,"GRADED",clock.time.plusSeconds(300));
        assertThat(discovery.detail(p.id(),s.id()).unavailableReason()).isEqualTo("ATTEMPTS_EXHAUSTED");
        assertThat(discovery.list(p.id(),Tab.AVAILABLE,page).content()).isEmpty();
        clock.time=s.endTime();
        assertThat(discovery.list(p.id(),Tab.EXPIRED,page).content()).hasSize(1);
        assertThat(discovery.list(p.id(),Tab.COMPLETED,page).content()).hasSize(1);
        assertThat(jdbc.queryForObject("select status from exam_sessions where id=?",String.class,s.id())).isEqualTo("SCHEDULED");
    }
    @Test void membershipRemovalPreservesResumeAndHistoryButNotNewStart() {
        var owner=user("CREATOR"); var p=user("PARTICIPANT"); var other=user("PARTICIPANT");
        var c1=classes.create(owner.id(),new WriteClassroom("One",null));
        var c2=classes.create(owner.id(),new WriteClassroom("Two",null));
        classes.add(owner.id(),c1.id(),p.id()); classes.add(owner.id(),c2.id(),p.id());
        var s=session(owner,p,AccessType.CLASS,List.of(c1.id(),c2.id())); clock.time=s.startTime();
        assertThat(discovery.list(p.id(),Tab.AVAILABLE,page).content()).filteredOn(v->v.id().equals(s.id())).hasSize(1);
        var attempt=seed(p,s,1,"IN_PROGRESS",clock.time.plusSeconds(300));
        classes.remove(owner.id(),c1.id(),p.id()); classes.remove(owner.id(),c2.id(),p.id());
        var view=discovery.detail(p.id(),s.id());
        assertThat(view.canContinue()).isTrue(); assertThat(view.canStart()).isFalse(); assertThat(view.activeAttemptId()).isEqualTo(attempt);
        assertThat(discovery.history(p.id(),s.id(),page).content()).hasSize(1);
        assertThatThrownBy(()->discovery.detail(other.id(),s.id())).hasMessage("SESSION_NOT_FOUND");
        clock.time=clock.time.plusSeconds(300);
        assertThat(discovery.detail(p.id(),s.id()).unavailableReason()).isEqualTo("ATTEMPT_DEADLINE_PASSED");
        assertThat(discovery.detail(p.id(),s.id()).canContinue()).isFalse();
        assertThat(discovery.history(p.id(),s.id(),page).content().getFirst().status()).isEqualTo("IN_PROGRESS");
        jdbc.update("update attempts set status='EXPIRED' where id=?",attempt);
        assertThat(discovery.detail(p.id(),s.id()).unavailableReason()).isEqualTo("NOT_ASSIGNED");
        assertThat(discovery.list(p.id(),Tab.COMPLETED,page).content()).hasSize(1);
        classes.add(owner.id(),c1.id(),p.id());
        assertThat(discovery.detail(p.id(),s.id()).canStart()).isTrue();
    }
    @Test void removedMembershipWithoutHistoryLosesDetailAndList() {
        var owner=user("CREATOR"); var p=user("PARTICIPANT"); var c=classes.create(owner.id(),new WriteClassroom("Class",null));
        classes.add(owner.id(),c.id(),p.id()); var s=session(owner,p,AccessType.CLASS,List.of(c.id()));
        classes.remove(owner.id(),c.id(),p.id());
        assertThat(discovery.list(p.id(),Tab.UPCOMING,page).content()).noneMatch(v->v.id().equals(s.id()));
        assertThatThrownBy(()->discovery.detail(p.id(),s.id())).hasMessage("SESSION_NOT_FOUND");
    }
    @Test void publicStillRequiresActiveParticipantAndMetadataNeverLeaksAnswers() throws Exception {
        var owner=user("CREATOR"); var p=user("PARTICIPANT"); var s=session(owner,p,AccessType.PUBLIC,List.of());
        String url="/api/v1/participant/exam-sessions/"+s.id();
        mvc.perform(get(url)).andExpect(status().isUnauthorized());
        mvc.perform(get(url).with(as(owner))).andExpect(status().isForbidden());
        var admin=user("PARTICIPANT"); jdbc.update("delete from user_roles where user_id=?",admin.id());
        jdbc.update("insert into user_roles(user_id,role) values (?,'ADMIN')",admin.id());
        mvc.perform(get(url).with(as(admin))).andExpect(status().isForbidden());
        var response=mvc.perform(get(url).with(as(p))).andExpect(status().isOk()).andExpect(jsonPath("$.questionCount").value(1))
                .andExpect(jsonPath("$.totalScore").value("1")).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("SECRET QUESTION","SECRET EXPLANATION","correctBoolean","snapshot","participants","classrooms","rawScore","passed");
        mvc.perform(get(url+"/attempts").with(as(p))).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        jdbc.update("update users set status='LOCKED' where id=?",p.id());
        mvc.perform(get(url).with(as(p))).andExpect(status().isForbidden());
    }
    @Test void privateDraftCancelledUnknownAndOtherHistoryAreNotDiscoverable() throws Exception {
        var owner=user("CREATOR"); var p=user("PARTICIPANT"); var other=user("PARTICIPANT");
        var s=session(owner,p,AccessType.INDIVIDUAL,List.of());
        String base="/api/v1/participant/exam-sessions/";
        mvc.perform(get(base+s.id()).with(as(other))).andExpect(status().isNotFound());
        mvc.perform(get(base+s.id()+"/attempts").with(as(other))).andExpect(status().isNotFound());
        mvc.perform(get(base+UUID.randomUUID()).with(as(p))).andExpect(status().isNotFound());
        sessions.cancel(owner.id(),s.id(),s.revision());
        mvc.perform(get(base+s.id()).with(as(p))).andExpect(status().isNotFound());
        jdbc.update("update exam_sessions set status='DRAFT' where id=?",s.id());
        mvc.perform(get(base+s.id()).with(as(p))).andExpect(status().isNotFound());
        for(String query:List.of("tab=ALL","page=-1","size=101","tab=__proto__"))
            mvc.perform(get("/api/v1/participant/exam-sessions?"+query).with(as(p))).andExpect(status().isBadRequest());
    }
    @Test void stablePaginationAndHistoryAreScopedToCaller() {
        var owner=user("CREATOR"); var p=user("PARTICIPANT","CREATOR"); var other=user("PARTICIPANT");
        var first=session(owner,p,AccessType.INDIVIDUAL,List.of()); var second=session(owner,p,AccessType.INDIVIDUAL,List.of());
        var p0=discovery.list(p.id(),Tab.UPCOMING,new PageQuery(0,1)); var p1=discovery.list(p.id(),Tab.UPCOMING,new PageQuery(1,1));
        assertThat(p0.totalElements()).isEqualTo(2); assertThat(p0.totalPages()).isEqualTo(2);
        assertThat(p0.content().getFirst().id()).isNotEqualTo(p1.content().getFirst().id());
        assertThat(discovery.list(p.id(),Tab.UPCOMING,new PageQuery(2,1)).content()).isEmpty();
        seed(p,first,1,"SUBMITTED",first.startTime().plusSeconds(300)); seed(p,first,2,"GRADED",first.startTime().plusSeconds(300));
        seed(other,first,1,"GRADED",first.startTime().plusSeconds(300));
        assertThat(discovery.history(p.id(),first.id(),new PageQuery(0,1)).totalElements()).isEqualTo(2);
        assertThat(discovery.history(p.id(),second.id(),page).content()).isEmpty();
    }
    @Test void constraintsProtectActiveAttemptNumberVersionAndHistory() {
        var owner=user("CREATOR"); var p=user("PARTICIPANT"); var s=session(owner,p,AccessType.INDIVIDUAL,List.of());
        seed(p,s,1,"IN_PROGRESS",s.startTime().plusSeconds(300));
        assertThatThrownBy(()->seed(p,s,2,"IN_PROGRESS",s.startTime().plusSeconds(300))).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(()->seed(p,s,1,"SUBMITTED",s.startTime().plusSeconds(300))).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(()->jdbc.update("delete from exam_sessions where id=?",s.id())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        var other=session(owner,p,AccessType.INDIVIDUAL,List.of());
        assertThatThrownBy(()->jdbc.update("update attempts set exam_version_id=? where session_id=?",other.examVersionId(),s.id())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void migrationFromV9PreservesSessionRows() {
        String schema="discovery_upgrade_"+UUID.randomUUID().toString().replace("-","");
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("9").load().migrate();
        var owner=user("CREATOR"); var p=user("PARTICIPANT"); var s=session(owner,p,AccessType.PUBLIC,List.of());
        jdbc.update("insert into "+schema+".users select * from public.users where id=?",owner.id());
        jdbc.update("insert into "+schema+".exams select * from public.exams where id=?",s.examId());
        jdbc.update("insert into "+schema+".exam_versions select * from public.exam_versions where id=?",s.examVersionId());
        String columns=String.join(",",jdbc.queryForList("select column_name from information_schema.columns where table_schema=? and table_name='exam_sessions' order by ordinal_position",String.class,schema));
        jdbc.update("insert into "+schema+".exam_sessions ("+columns+") select "+columns+" from public.exam_sessions where id=?",s.id());
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
        assertThat(jdbc.queryForObject("select title from "+schema+".exam_sessions where id=?",String.class,s.id())).isEqualTo(s.title());
        assertThat(jdbc.queryForObject("select count(*) from "+schema+".attempts",Integer.class)).isZero();
    }
    private Detail session(AuthDtos.UserSummary owner,AuthDtos.UserSummary p,AccessType access,List<UUID> classrooms) {
        var e=exams.create(owner.id(),new CreateExam("Discovery exam","Description"));
        var q=questions.create(owner.id(),new QuestionDtos.WriteQuestion(QuestionType.TRUE_FALSE,QuestionStatus.ACTIVE,"SECRET QUESTION","SECRET EXPLANATION",Difficulty.EASY,null,List.of(),List.of(),true,null,null,null));
        var v=exams.add(owner.id(),e.versions().getFirst().id(),new AddQuestions(0L,List.of(new Source(q.id(),q.revision()))));
        v=exams.publish(owner.id(),v.id(),v.revision());
        var s=sessions.create(owner.id(),new WriteSession(null,"Discovery",v.id(),clock.time.plusSeconds(60),clock.time.plusSeconds(1260),20,2,"0.5",access,
                classrooms,access==AccessType.INDIVIDUAL?List.of(p.id()):List.of(),false,false,null,null));
        createdSessions.add(s.id());
        return sessions.schedule(owner.id(),s.id(),s.revision());
    }
    private UUID seed(AuthDtos.UserSummary p,Detail s,int number,String status,Instant deadline) {
        UUID id=UUID.randomUUID();
        jdbc.update("insert into attempts(id,participant_id,session_id,exam_version_id,attempt_number,status,started_at,deadline,submitted_at) values (?,?,?,?,?,?,?,?,?)",
                id,p.id(),s.id(),s.examVersionId(),number,status,java.sql.Timestamp.from(s.startTime()),java.sql.Timestamp.from(deadline),status.equals("IN_PROGRESS")?null:java.sql.Timestamp.from(deadline));
        jdbc.update("update exam_sessions set first_attempt_at=? where id=?",java.sql.Timestamp.from(s.startTime()),s.id());
        return id;
    }
    private AuthDtos.UserSummary user(String... roles) { return identity.register(new AuthDtos.RegisterRequest(UUID.randomUUID()+"@example.com","Discovery test password 123","Tester",List.of(roles))); }
    private RequestPostProcessor as(AuthDtos.UserSummary user) { String token=tokens.issue(user,UUID.randomUUID().toString()).accessToken(); return r->{r.addHeader("Authorization","Bearer "+token);return r;}; }
}
