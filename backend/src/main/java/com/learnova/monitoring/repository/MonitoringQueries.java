package com.learnova.monitoring.repository;

import com.learnova.monitoring.dto.MonitoringDtos.Participant;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class MonitoringQueries {
    private final JdbcClient jdbc;
    public MonitoringQueries(JdbcClient jdbc) { this.jdbc=jdbc; }

    // Hợp nhất assignment hiện tại và lịch sử; mỗi người hiển thị lượt mới nhất.
    public List<Participant> participants(UUID session, int totalQuestions, Instant now) {
        return jdbc.sql("""
            with audience as (
              select participant_id from attempts where session_id=:session
              union select i.user_id from session_individual_assignments i join exam_sessions s on s.id=i.session_id
                where i.session_id=:session and s.access_type='INDIVIDUAL'
              union select m.user_id from session_class_assignments c
                join classroom_memberships m on m.classroom_id=c.classroom_id
                join exam_sessions s on s.id=c.session_id
                where c.session_id=:session and s.access_type='CLASS' and m.status='ACTIVE'
            )
            select p.participant_id,u.display_name,a.id,a.attempt_number,a.status,a.last_seen_at,
              (select count(*) from attempt_answers x where x.attempt_id=a.id and
                (jsonb_array_length(x.answer->'optionIds')>0 or x.answer->>'booleanValue' is not null
                  or x.answer->>'numericValue' is not null)) answered_count
            from audience p join users u on u.id=p.participant_id
            left join lateral (select * from attempts where session_id=:session and participant_id=p.participant_id
              order by attempt_number desc limit 1) a on true
            order by u.display_name,p.participant_id
            """).param("session",session).query((r,n)-> {
                var timestamp=r.getTimestamp("last_seen_at");
                Instant seen=timestamp==null?null:timestamp.toInstant();
                String status=r.getString("status");
                String connection=!"IN_PROGRESS".equals(status)?"NOT_APPLICABLE":
                    seen!=null && seen.isAfter(now.minusSeconds(45))?"CONNECTED":"DISCONNECTED";
                return new Participant(r.getObject("participant_id",UUID.class),r.getString("display_name"),
                    r.getObject("id",UUID.class),r.getInt("attempt_number"),status==null?"NOT_STARTED":status,
                    r.getInt("answered_count"),totalQuestions,seen,connection);
            }).list();
    }
}
