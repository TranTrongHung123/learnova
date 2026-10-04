package com.learnova.attempt.repository;

import com.learnova.attempt.dto.AttemptDtos.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
public class AttemptRepository {
    public record Attempt(UUID id, UUID participantId, UUID sessionId, UUID versionId, String title,
                          int number, String status, Instant startedAt, Instant deadline) {}
    public record Entry(UUID questionId, List<UUID> optionOrder, State state) {}
    private final JdbcClient jdbc;
    private final ObjectMapper json;
    public AttemptRepository(JdbcClient jdbc, ObjectMapper json) { this.jdbc=jdbc; this.json=json; }
    public Optional<Attempt> owned(UUID actor, UUID id, boolean lock) {
        return jdbc.sql("select a.*,s.title from attempts a join exam_sessions s on s.id=a.session_id where a.id=:id and a.participant_id=:actor"+(lock?" for update of a":""))
                .param("id",id).param("actor",actor).query((r,n)->row(r)).optional();
    }
    public Optional<UUID> active(UUID actor, UUID session) {
        return jdbc.sql("select id from attempts where participant_id=:actor and session_id=:session and status='IN_PROGRESS'")
                .param("actor",actor).param("session",session).query(UUID.class).optional();
    }
    public int count(UUID actor, UUID session) {
        return jdbc.sql("select count(*) from attempts where participant_id=:actor and session_id=:session")
                .param("actor",actor).param("session",session).query(Integer.class).single();
    }
    public void create(UUID id, UUID actor, UUID session, UUID version, int number, Instant start, Instant deadline) {
        jdbc.sql("insert into attempts(id,participant_id,session_id,exam_version_id,attempt_number,status,started_at,deadline) values (:id,:actor,:session,:version,:number,'IN_PROGRESS',:start,:deadline)")
                .param("id",id).param("actor",actor).param("session",session).param("version",version).param("number",number)
                .param("start",start.atOffset(ZoneOffset.UTC)).param("deadline",deadline.atOffset(ZoneOffset.UTC)).update();
    }
    public void addQuestion(UUID attempt, UUID version, UUID question, int position, List<UUID> order) {
        jdbc.sql("insert into attempt_answers(attempt_id,exam_version_id,question_id,position,option_order) values (:attempt,:version,:question,:position,cast(:options as jsonb))")
                .param("attempt",attempt).param("version",version).param("question",question).param("position",position)
                .param("options",json.writeValueAsString(order)).update();
    }
    public List<Entry> entries(UUID attempt) {
        return jdbc.sql("select * from attempt_answers where attempt_id=:attempt order by position").param("attempt",attempt)
                .query((r,n)->new Entry(r.getObject("question_id",UUID.class),
                        Arrays.asList(json.readValue(r.getString("option_order"),UUID[].class)),
                        new State(r.getObject("question_id",UUID.class),json.readValue(r.getString("answer"),Answer.class),
                                r.getBoolean("marked_for_review"),r.getLong("revision"),r.getObject("active_time_ms",Long.class),instant(r,"saved_at")))).list();
    }
    public void save(UUID attempt, UUID question, Save input, Long activeTime, Instant now) {
        jdbc.sql("update attempt_answers set answer=cast(:answer as jsonb),marked_for_review=:review,revision=revision+1,active_time_ms=:time,saved_at=:now where attempt_id=:attempt and question_id=:question")
                .param("answer",json.writeValueAsString(input.answer())).param("review",input.markedForReview()).param("time",activeTime,Types.BIGINT)
                .param("now",now.atOffset(ZoneOffset.UTC)).param("attempt",attempt).param("question",question).update();
    }
    private Attempt row(ResultSet r) throws SQLException {
        return new Attempt(r.getObject("id",UUID.class),r.getObject("participant_id",UUID.class),r.getObject("session_id",UUID.class),
                r.getObject("exam_version_id",UUID.class),r.getString("title"),r.getInt("attempt_number"),r.getString("status"),instant(r,"started_at"),instant(r,"deadline"));
    }
    private static Instant instant(ResultSet r,String name) throws SQLException { var t=r.getTimestamp(name); return t==null?null:t.toInstant(); }
}
