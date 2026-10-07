package com.learnova.reporting.repository;

import com.learnova.reporting.dto.DashboardDtos.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class DashboardQueries {
    private final JdbcClient jdbc;
    public DashboardQueries(JdbcClient jdbc) { this.jdbc=jdbc; }
    // Cùng semantics ResultVisibility; lọc trước aggregate để không lộ điểm chưa công bố.
    private static final String VISIBLE_BEST = """
        with ranked as (
          select a.id,a.session_id,a.submitted_at,s.title,r.raw_score,r.total_score,r.passed,
            row_number() over(partition by a.session_id order by r.raw_score desc,a.submitted_at,a.id) ranking
          from attempts a join attempt_results r on r.attempt_id=a.id join exam_sessions s on s.id=a.session_id
          where a.participant_id=:actor and a.status='GRADED' and s.result_display_mode<>'HIDDEN'
            and (s.result_release_policy='IMMEDIATE'
              or (s.result_release_policy='AFTER_SESSION_END' and s.end_time<=:now)
              or (s.result_release_policy='MANUAL' and s.results_released_at is not null))
        )
        """;
    public Scores scores(UUID actor, Instant now) {
        return query(VISIBLE_BEST+"select count(*) total,round(avg(raw_score*100/total_score),2) average from ranked where ranking=1",actor,now)
            .query((r,n)->new Scores(r.getLong("total"),decimal(r,"average"))).single();
    }
    public List<Result> participantResults(UUID actor, Instant now) {
        return query(VISIBLE_BEST+"select * from ranked where ranking=1 order by submitted_at desc,id limit 5",actor,now)
            .query((r,n)->result(r)).list();
    }
    public List<Attempt> inProgress(UUID actor, Instant now) {
        return query("""
            select a.id,a.session_id,s.title,a.deadline from attempts a join exam_sessions s on s.id=a.session_id
            where a.participant_id=:actor and a.status='IN_PROGRESS' and a.deadline>:now and s.status<>'CANCELLED'
            order by a.deadline,a.id limit 5
            """,actor,now).query((r,n)->new Attempt(r.getObject("id",UUID.class),r.getObject("session_id",UUID.class),r.getString("title"),instant(r,"deadline"))).list();
    }
    private static final String ACTIVE="status in ('SCHEDULED','OPEN') and start_time<=:now and end_time>:now";
    private static final String UPCOMING="status in ('SCHEDULED','OPEN') and start_time>:now";
    public Counts counts(UUID actor, Instant now) {
        return query("""
            select (select count(*) from questions where owner_id=:actor) questions,
              (select count(*) from exams where owner_id=:actor) exams,
              (select count(*) from exam_sessions where owner_id=:actor and %s) active,
              (select count(*) from exam_sessions where owner_id=:actor and %s) upcoming,
              (select count(*) from (
                select a.participant_id from attempts a join exam_sessions s on s.id=a.session_id where s.owner_id=:actor
                union select i.user_id from session_individual_assignments i join exam_sessions s on s.id=i.session_id where s.owner_id=:actor and s.access_type='INDIVIDUAL' and s.status<>'CANCELLED'
                union select m.user_id from session_class_assignments c join exam_sessions s on s.id=c.session_id
                  join classroom_memberships m on m.classroom_id=c.classroom_id where s.owner_id=:actor and s.access_type='CLASS' and s.status<>'CANCELLED' and m.status='ACTIVE'
              ) audience) participants
            """.formatted(ACTIVE,UPCOMING),actor,now).query((r,n)->new Counts(r.getLong("questions"),r.getLong("exams"),r.getLong("active"),r.getLong("upcoming"),r.getLong("participants"))).single();
    }
    public QuestionCounts questionCounts(UUID actor) {
        return jdbc.sql("""
            select count(*) filter(where status='DRAFT') draft,count(*) filter(where status='ACTIVE') active,
              count(*) filter(where status='ARCHIVED') archived from questions where owner_id=:actor
            """).param("actor",actor).query((r,n)->new QuestionCounts(r.getLong("draft"),r.getLong("active"),r.getLong("archived"))).single();
    }
    public List<Session> sessions(UUID actor, Instant now, boolean upcoming) {
        return query("select id,title,start_time,end_time from exam_sessions where owner_id=:actor and "+(upcoming?UPCOMING:ACTIVE)
            +" order by "+(upcoming?"start_time":"end_time")+",id limit 5",actor,now)
            .query((r,n)->new Session(r.getObject("id",UUID.class),r.getString("title"),instant(r,"start_time"),instant(r,"end_time"))).list();
    }
    public List<Exam> exams(UUID actor) {
        return jdbc.sql("select id,name,status from exams where owner_id=:actor order by updated_at desc,id limit 5").param("actor",actor)
            .query((r,n)->new Exam(r.getObject("id",UUID.class),r.getString("name"),r.getString("status"))).list();
    }
    public List<Result> creatorResults(UUID actor) {
        return jdbc.sql("""
            select a.id,a.session_id,a.submitted_at,s.title,r.raw_score,r.total_score,r.passed
            from attempts a join exam_sessions s on s.id=a.session_id join attempt_results r on r.attempt_id=a.id
            where s.owner_id=:actor and a.status='GRADED' order by a.submitted_at desc,a.id limit 5
            """).param("actor",actor).query((r,n)->result(r)).list();
    }
    public Admin admin(Instant now) {
        return jdbc.sql("""
            select (select count(*) from users) users,(select count(*) from users where status='ACTIVE') active_users,
              (select count(*) from user_roles where role='PARTICIPANT') participants,
              (select count(*) from user_roles where role='CREATOR') creators,
              (select count(*) from user_roles where role='ADMIN') admins,
              (select count(*) from exams) exams,(select count(*) from exam_sessions) sessions,
              (select count(*) from exam_sessions where %s) active,
              (select count(*) from exam_sessions where %s) upcoming
            """.formatted(ACTIVE,UPCOMING)).param("now",now.atOffset(ZoneOffset.UTC))
            .query((r,n)->new Admin(now,r.getLong("users"),r.getLong("active_users"),r.getLong("participants"),r.getLong("creators"),r.getLong("admins"),r.getLong("exams"),r.getLong("sessions"),r.getLong("active"),r.getLong("upcoming"))).single();
    }
    private JdbcClient.StatementSpec query(String sql,UUID actor,Instant now) {
        return jdbc.sql(sql).param("actor",actor).param("now",now.atOffset(ZoneOffset.UTC));
    }
    private static Result result(ResultSet r) throws SQLException {
        return new Result(r.getObject("id",UUID.class),r.getObject("session_id",UUID.class),r.getString("title"),instant(r,"submitted_at"),decimal(r,"raw_score"),decimal(r,"total_score"),r.getBoolean("passed"));
    }
    private static String decimal(ResultSet r,String name) throws SQLException { var value=r.getBigDecimal(name); return value==null?null:value.stripTrailingZeros().toPlainString(); }
    private static Instant instant(ResultSet r,String name) throws SQLException { return r.getTimestamp(name).toInstant(); }
}
