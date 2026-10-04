package com.learnova.session.repository;

import com.learnova.session.dto.DiscoveryDtos.*;
import com.learnova.shared.api.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class DiscoveryQueries {
    private final JdbcClient jdbc;
    public DiscoveryQueries(JdbcClient jdbc) { this.jdbc = jdbc; }

    // EXISTS tránh nhân bản Session khi Participant thuộc nhiều lớp được giao.
    private static final String BASE = """
        with visible as (
          select s.*, e.description, u.display_name creator_name,
            case when s.status in ('SCHEDULED','OPEN') then
              case when s.end_time <= :now then 'CLOSED' when s.start_time > :now then 'SCHEDULED' else 'OPEN' end
              else s.status end effective_status,
            (s.access_type='PUBLIC' or
             (s.access_type='INDIVIDUAL' and exists(select 1 from session_individual_assignments i where i.session_id=s.id and i.user_id=:actor)) or
             (s.access_type='CLASS' and exists(select 1 from session_class_assignments c join classroom_memberships m on m.classroom_id=c.classroom_id
               where c.session_id=s.id and m.user_id=:actor and m.status='ACTIVE'))) assigned,
            a.used, a.completed, a.last_completed, a.active_id, a.active_deadline
          from exam_sessions s join exams e on e.id=s.exam_id join users u on u.id=s.owner_id
          cross join lateral (
            select count(*) used, count(*) filter(where status <> 'IN_PROGRESS') completed,
              max(coalesce(submitted_at,deadline)) filter(where status <> 'IN_PROGRESS') last_completed,
              (array_agg(id) filter(where status='IN_PROGRESS'))[1] active_id,
              max(deadline) filter(where status='IN_PROGRESS') active_deadline
            from attempts where participant_id=:actor and session_id=s.id
          ) a
          where s.status not in ('DRAFT','CANCELLED')
        ), eligible as (
          select *, (assigned and effective_status='OPEN' and used<max_attempts and active_id is null) can_start,
            (active_id is not null and active_deadline>:now) can_continue
          from visible where assigned or used>0
        )
        """;
    public PageResponse<Session> list(UUID actor, Instant now, Tab tab, PageQuery page) {
        String filter = switch (tab) {
            case AVAILABLE -> "can_start or can_continue";
            case UPCOMING -> "assigned and effective_status='SCHEDULED'";
            case COMPLETED -> "completed>0";
            case EXPIRED -> "effective_status='CLOSED'";
        };
        String order = switch (tab) {
            case AVAILABLE -> "end_time asc";
            case UPCOMING -> "start_time asc";
            case COMPLETED -> "last_completed desc";
            case EXPIRED -> "end_time desc";
        };
        long total = query(BASE + "select count(*) from eligible where " + filter, actor, now).query(Long.class).single();
        var rows = query(BASE + projection() + " where " + filter + " order by " + order + ", id limit :limit offset :offset", actor, now)
                .param("limit", page.size()).param("offset", (long)page.page()*page.size()).query((r,n) -> session(r,now)).list();
        return new PageResponse<>(rows,page.page(),page.size(),total,(int)((total+page.size()-1)/page.size()));
    }
    public Optional<Session> detail(UUID actor, UUID id, Instant now) {
        return query(BASE + projection() + " where id=:id",actor,now).param("id",id).query((r,n)->session(r,now)).optional();
    }
    private String projection() {
        return """
            select eligible.*, (select count(*) from exam_version_questions q where q.version_id=eligible.exam_version_id) question_count,
              (select coalesce(sum(points),0) from exam_version_questions q where q.version_id=eligible.exam_version_id) total_score
            from eligible
            """;
    }
    private JdbcClient.StatementSpec query(String sql, UUID actor, Instant now) {
        return jdbc.sql(sql).param("actor",actor).param("now",now.atOffset(ZoneOffset.UTC));
    }
    private Session session(ResultSet r, Instant now) throws SQLException {
        boolean start=r.getBoolean("can_start"), resume=r.getBoolean("can_continue");
        String reason=null;
        if (!start && !resume) {
            if (r.getObject("active_id")!=null) reason="ATTEMPT_DEADLINE_PASSED";
            else if (!r.getBoolean("assigned")) reason="NOT_ASSIGNED";
            else if (r.getString("effective_status").equals("SCHEDULED")) reason="NOT_STARTED";
            else if (r.getString("effective_status").equals("CLOSED")) reason="SESSION_CLOSED";
            else reason="ATTEMPTS_EXHAUSTED";
        }
        return new Session(r.getObject("id",UUID.class),r.getString("title"),r.getString("description"),r.getString("creator_name"),
                instant(r,"start_time"),instant(r,"end_time"),r.getInt("duration_minutes"),r.getInt("question_count"),
                r.getBigDecimal("total_score").stripTrailingZeros().toPlainString(),r.getBigDecimal("passing_score").stripTrailingZeros().toPlainString(),
                r.getInt("max_attempts"),r.getLong("used"),r.getString("access_type"),r.getString("effective_status"),
                r.getString("result_display_mode"),r.getString("result_release_policy"),now,start,resume,r.getObject("active_id",UUID.class),reason);
    }
    public PageResponse<Attempt> history(UUID actor, UUID id, PageQuery page) {
        String where=" from attempts where participant_id=:actor and session_id=:id";
        long total=jdbc.sql("select count(*)"+where).param("actor",actor).param("id",id).query(Long.class).single();
        var rows=jdbc.sql("select *"+where+" order by started_at desc,id limit :limit offset :offset")
                .param("actor",actor).param("id",id).param("limit",page.size()).param("offset",(long)page.page()*page.size())
                .query((r,n)->new Attempt(r.getObject("id",UUID.class),r.getInt("attempt_number"),r.getString("status"),
                        instant(r,"started_at"),instant(r,"deadline"),instant(r,"submitted_at"))).list();
        return new PageResponse<>(rows,page.page(),page.size(),total,(int)((total+page.size()-1)/page.size()));
    }
    private static Instant instant(ResultSet r,String field) throws SQLException {
        var value=r.getTimestamp(field); return value==null?null:value.toInstant();
    }
}
