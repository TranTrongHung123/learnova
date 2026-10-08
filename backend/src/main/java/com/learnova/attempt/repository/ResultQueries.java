package com.learnova.attempt.repository;

import com.learnova.attempt.dto.AttemptDtos.Answer;
import com.learnova.attempt.dto.ResultDtos.*;
import com.learnova.attempt.service.ResultVisibility;
import com.learnova.shared.api.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
public class ResultQueries {

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public ResultQueries(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public record AttemptRow(
        UUID id,
        UUID sessionId,
        UUID participantId,
        UUID ownerId,
        String title,
        int number,
        String status,
        Instant start,
        Instant submitted,
        String mode,
        String policy,
        Instant end,
        Instant released,
        Score score
    ) {}

    public Optional<AttemptRow> attempt(UUID id) {
        return jdbc
            .sql(
                """
                select a.*,s.owner_id,s.title,s.result_display_mode,s.result_release_policy,s.end_time,s.results_released_at,
                  r.raw_score,r.total_score,r.passed
                from attempts a join exam_sessions s on s.id=a.session_id
                left join attempt_results r on r.attempt_id=a.id and a.status='GRADED' where a.id=:id
                """
            )
            .param("id", id)
            .query((r, n) ->
                new AttemptRow(
                    id,
                    r.getObject("session_id", UUID.class),
                    r.getObject("participant_id", UUID.class),
                    r.getObject("owner_id", UUID.class),
                    r.getString("title"),
                    r.getInt("attempt_number"),
                    r.getString("status"),
                    instant(r, "started_at"),
                    instant(r, "submitted_at"),
                    r.getString("result_display_mode"),
                    r.getString("result_release_policy"),
                    instant(r, "end_time"),
                    instant(r, "results_released_at"),
                    score(r)
                )
            )
            .optional();
    }

    public Summary summary(AttemptRow a) {
        return jdbc
            .sql(
                """
                select count(*) filter(where r.correct) correct_count,
                  count(*) filter(where not r.correct and (jsonb_array_length(x.answer->'optionIds')>0
                    or x.answer->>'booleanValue' is not null or x.answer->>'numericValue' is not null)) incorrect_count,
                  count(*) filter(where jsonb_array_length(x.answer->'optionIds')=0
                    and x.answer->>'booleanValue' is null and x.answer->>'numericValue' is null) unanswered_count
                from attempt_result_questions r join attempt_answers x using(attempt_id,question_id) where r.attempt_id=:id
                """
            )
            .param("id", a.id())
            .query((r, n) ->
                new Summary(
                    r.getInt("correct_count"),
                    r.getInt("incorrect_count"),
                    r.getInt("unanswered_count"),
                    Duration.between(a.start(), a.submitted()).getSeconds()
                )
            )
            .single();
    }

    public List<Question> questions(UUID id) {
        return jdbc
            .sql(
                """
                select q.id,q.snapshot,x.answer,x.option_order,r.correct,r.points,r.awarded_score
                from attempt_answers x join exam_version_questions q on q.id=x.question_id and q.version_id=x.exam_version_id
                join attempt_result_questions r on r.attempt_id=x.attempt_id and r.question_id=x.question_id
                where x.attempt_id=:id order by x.position
                """
            )
            .param("id", id)
            .query((r, n) -> {
                var s = json.readTree(r.getString("snapshot"));
                var options = new ArrayList<Option>();
                for (UUID option : json.readValue(r.getString("option_order"), UUID[].class))
                    for (var o : s.get("options"))
                        if (o.get("id").asText().equals(option.toString())) options.add(
                            new Option(
                                option,
                                o.get("content").asText(),
                                o.get("correct").asBoolean()
                            )
                        );
                return new Question(
                    r.getObject("id", UUID.class),
                    s.get("type").asText(),
                    s.get("content").asText(),
                    options,
                    json.readValue(r.getString("answer"), Answer.class),
                    s.path("correctBoolean").isBoolean()
                        ? s.get("correctBoolean").asBoolean()
                        : null,
                    value(s, "correctValue"),
                    value(s, "tolerance"),
                    value(s, "explanation"),
                    r.getBoolean("correct"),
                    decimal(r, "points"),
                    decimal(r, "awarded_score")
                );
            })
            .list();
    }

    private static String value(tools.jackson.databind.JsonNode node, String key) {
        var v = node.get(key);
        return v == null || v.isNull() ? null : v.asText();
    }

    // Lấy best từ toàn bộ lượt đã chấm trước khi phân trang; hòa điểm chọn lượt hoàn tất sớm hơn.
    private static final String HISTORY = """
    with audience as (%s), grouped as (
      select p.session_id,p.participant_id,count(a.id) attempt_count,max(a.submitted_at) completed_at
      from audience p left join attempts a on a.session_id=p.session_id and a.participant_id=p.participant_id
      group by p.session_id,p.participant_id
    )
    select g.*,s.title,e.name exam_name,u.display_name,s.result_display_mode,s.result_release_policy,
      s.end_time,s.results_released_at,b.id best_id,b.raw_score,b.total_score,b.passed
    from grouped g join exam_sessions s on s.id=g.session_id join exams e on e.id=s.exam_id
    join users u on u.id=g.participant_id
    left join lateral (
      select a.id,r.raw_score,r.total_score,r.passed from attempts a join attempt_results r on r.attempt_id=a.id
      where a.session_id=g.session_id and a.participant_id=g.participant_id and a.status='GRADED'
      order by r.raw_score desc,a.submitted_at,a.id limit 1
    ) b on true
    """;

    public PageResponse<History> history(UUID scope, boolean creator, Instant now, PageQuery page) {
        String audience = creator
            ? """
              select session_id,participant_id from attempts where session_id=:scope
              union select i.session_id,i.user_id from session_individual_assignments i join exam_sessions s on s.id=i.session_id
                where i.session_id=:scope and s.access_type='INDIVIDUAL'
              union select c.session_id,m.user_id from session_class_assignments c join classroom_memberships m on m.classroom_id=c.classroom_id
                join exam_sessions s on s.id=c.session_id where c.session_id=:scope and s.access_type='CLASS' and m.status='ACTIVE'
              """
            : "select distinct session_id,participant_id from attempts where participant_id=:scope";
        String sql = HISTORY.formatted(audience);
        long total = jdbc
            .sql("select count(*) from (" + sql + ") h")
            .param("scope", scope)
            .query(Long.class)
            .single();
        var rows = jdbc
            .sql(
                sql +
                    " order by g.completed_at desc nulls last,g.session_id,g.participant_id limit :limit offset :offset"
            )
            .param("scope", scope)
            .param("limit", page.size())
            .param("offset", (long) page.page() * page.size())
            .query((r, n) -> {
                String availability = creator
                    ? r.getObject("best_id") != null
                        ? "AVAILABLE"
                        : "PENDING_GRADING"
                    : ResultVisibility.availability(
                          r.getString("result_display_mode"),
                          r.getString("result_release_policy"),
                          instant(r, "end_time"),
                          instant(r, "results_released_at"),
                          now,
                          r.getObject("best_id") != null
                      );
                boolean visible = availability.equals("AVAILABLE");
                return new History(
                    r.getObject("session_id", UUID.class),
                    r.getString("title"),
                    r.getString("exam_name"),
                    r.getObject("participant_id", UUID.class),
                    r.getString("display_name"),
                    r.getLong("attempt_count"),
                    instant(r, "completed_at"),
                    visible ? r.getObject("best_id", UUID.class) : null,
                    availability,
                    visible ? score(r) : null
                );
            })
            .list();
        return new PageResponse<>(
            rows,
            page.page(),
            page.size(),
            total,
            (int) ((total + page.size() - 1) / page.size())
        );
    }

    public PageResponse<UUID> attemptIds(UUID session, UUID participant, PageQuery page) {
        String from = " from attempts where session_id=:session and participant_id=:participant";
        long total = jdbc
            .sql("select count(*)" + from)
            .param("session", session)
            .param("participant", participant)
            .query(Long.class)
            .single();
        var ids = jdbc
            .sql(
                "select id" + from + " order by attempt_number desc,id limit :limit offset :offset"
            )
            .param("session", session)
            .param("participant", participant)
            .param("limit", page.size())
            .param("offset", (long) page.page() * page.size())
            .query(UUID.class)
            .list();
        return new PageResponse<>(
            ids,
            page.page(),
            page.size(),
            total,
            (int) ((total + page.size() - 1) / page.size())
        );
    }

    public Instant releasedAt(UUID session) {
        return jdbc
            .sql("select results_released_at from exam_sessions where id=:id")
            .param("id", session)
            .query((r, n) -> instant(r, "results_released_at"))
            .optional()
            .orElse(null);
    }

    private static Score score(ResultSet r) throws SQLException {
        return r.getBigDecimal("raw_score") == null
            ? null
            : new Score(decimal(r, "raw_score"), decimal(r, "total_score"), r.getBoolean("passed"));
    }

    private static String decimal(ResultSet r, String name) throws SQLException {
        return r.getBigDecimal(name).stripTrailingZeros().toPlainString();
    }

    private static Instant instant(ResultSet r, String name) throws SQLException {
        var t = r.getTimestamp(name);
        return t == null ? null : t.toInstant();
    }
}
