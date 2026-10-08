package com.learnova.reporting.repository;

import com.learnova.exam.dto.ExamDtos.Snapshot;
import com.learnova.reporting.dto.ReportingDtos.*;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
public class ReportingQueries {

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public ReportingQueries(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    // Read projection dùng dữ liệu persisted; không phụ thuộc trang UI hoặc Question Bank.
    private static final String GRADED = """
    with graded as (
      select a.*,r.raw_score,r.total_score,r.passed,
        row_number() over(partition by a.participant_id order by r.raw_score desc,a.submitted_at,a.id) ranking
      from attempts a join attempt_results r on r.attempt_id=a.id
      where a.session_id=:id and a.status='GRADED'
    )
    """;

    public Overview overview(UUID id, boolean publicAccess) {
        return jdbc
            .sql(
                GRADED +
                    """
                    , audience as (
                      select participant_id from attempts where session_id=:id
                      union select i.user_id from session_individual_assignments i join exam_sessions s on s.id=i.session_id
                        where i.session_id=:id and s.access_type='INDIVIDUAL'
                      union select m.user_id from session_class_assignments c join classroom_memberships m on m.classroom_id=c.classroom_id
                        join exam_sessions s on s.id=c.session_id where c.session_id=:id and s.access_type='CLASS' and m.status='ACTIVE'
                    ), counts as (
                      select (select count(*) from audience) participants,
                        (select count(distinct participant_id) from attempts where session_id=:id
                          and status in ('SUBMITTED','EXPIRED','GRADED')) completed
                    )
                    select c.participants,c.completed,count(g.id) graded_count,round(avg(g.raw_score),4) average_score,
                      max(g.raw_score) highest_score,min(g.raw_score) lowest_score,
                      round(100.0*count(g.id) filter(where g.passed)/nullif(count(g.id),0),2) pass_rate,
                      round(100.0*c.completed/nullif(c.participants,0),2) completion_rate
                    from counts c left join graded g on g.ranking=1 group by c.participants,c.completed
                    """
            )
            .param("id", id)
            .query((r, n) ->
                new Overview(
                    r.getLong("participants"),
                    r.getLong("graded_count"),
                    r.getLong("completed"),
                    r.getBigDecimal("average_score"),
                    r.getBigDecimal("highest_score"),
                    r.getBigDecimal("lowest_score"),
                    r.getBigDecimal("pass_rate"),
                    publicAccess ? null : r.getBigDecimal("completion_rate")
                )
            )
            .single();
    }

    public List<Bucket> distribution(UUID id) {
        return jdbc
            .sql(
                GRADED +
                    """
                    select b.bucket,count(g.id) total from generate_series(0,9) b(bucket)
                    left join graded g on g.ranking=1 and least(9,floor(g.raw_score/g.total_score*10)::int)=b.bucket
                    group by b.bucket order by b.bucket
                    """
            )
            .param("id", id)
            .query((r, n) ->
                new Bucket(
                    r.getInt("bucket") * 10,
                    (r.getInt("bucket") + 1) * 10,
                    r.getInt("bucket") == 9,
                    r.getLong("total")
                )
            )
            .list();
    }

    private static final String ANSWERED = """
    (jsonb_array_length(x.answer->'optionIds')>0 or x.answer->>'booleanValue' is not null or x.answer->>'numericValue' is not null)
    """;

    public List<Question> questions(UUID id) {
        return jdbc
            .sql(
                """
                with samples as (
                  select x.question_id,r.correct,%s answered,
                    case when x.active_time_ms>=0 and x.saved_at between a.started_at and a.submitted_at
                      and x.active_time_ms<=extract(epoch from (least(a.submitted_at,a.deadline)-a.started_at))*1000
                      then x.active_time_ms end valid_time
                  from attempts a join attempt_answers x on x.attempt_id=a.id
                  join attempt_result_questions r on r.attempt_id=x.attempt_id and r.question_id=x.question_id
                  where a.session_id=:id and a.status='GRADED'
                )
                select q.id,q.position,q.points,q.snapshot,count(t.question_id) samples,
                  count(*) filter(where t.correct) correct_count,
                  count(*) filter(where not t.correct and t.answered) incorrect_count,
                  count(*) filter(where not t.answered) unanswered_count,
                  round(100.0*count(*) filter(where t.correct)/nullif(count(t.question_id),0),2) correct_rate,
                  round(100.0*count(*) filter(where not t.correct and t.answered)/nullif(count(t.question_id),0),2) incorrect_rate,
                  round(100.0*count(*) filter(where not t.answered)/nullif(count(t.question_id),0),2) unanswered_rate,
                  count(t.valid_time) timed_samples,round(avg(t.valid_time),2) average_time
                from exam_sessions s join exam_version_questions q on q.version_id=s.exam_version_id
                left join samples t on t.question_id=q.id where s.id=:id
                group by q.id order by q.position,q.id
                """.formatted(ANSWERED)
            )
            .param("id", id)
            .query((r, n) ->
                new Question(
                    r.getObject("id", UUID.class),
                    r.getInt("position"),
                    r.getBigDecimal("points").stripTrailingZeros().toPlainString(),
                    json.readValue(r.getString("snapshot"), Snapshot.class),
                    r.getLong("samples"),
                    r.getLong("correct_count"),
                    r.getLong("incorrect_count"),
                    r.getLong("unanswered_count"),
                    r.getBigDecimal("correct_rate"),
                    r.getBigDecimal("incorrect_rate"),
                    r.getBigDecimal("unanswered_rate"),
                    r.getLong("timed_samples"),
                    r.getBigDecimal("average_time")
                )
            )
            .list();
    }

    public void exportRows(UUID id, RowCallbackHandler consumer) {
        jdbc.sql(
            """
            select u.display_name,u.email,a.attempt_number,a.status,a.started_at,a.submitted_at,
              floor(extract(epoch from (a.submitted_at-a.started_at)))::bigint duration,
              r.raw_score,r.passed,b.best_score,c.correct_count,c.incorrect_count,c.unanswered_count
            from attempts a join users u on u.id=a.participant_id
            left join attempt_results r on r.attempt_id=a.id and a.status='GRADED'
            left join lateral (
              select max(r2.raw_score) best_score from attempts a2 join attempt_results r2 on r2.attempt_id=a2.id
              where a2.session_id=a.session_id and a2.participant_id=a.participant_id and a2.status='GRADED'
            ) b on true
            left join lateral (
              select count(*) filter(where rq.correct) correct_count,
                count(*) filter(where not rq.correct and %s) incorrect_count,
                count(*) filter(where not %s) unanswered_count
              from attempt_result_questions rq join attempt_answers x using(attempt_id,question_id) where rq.attempt_id=r.attempt_id
            ) c on r.attempt_id is not null
            where a.session_id=:id order by u.display_name,a.participant_id,a.attempt_number,a.id
            """.formatted(ANSWERED, ANSWERED)
        )
            .param("id", id)
            .query(consumer);
    }
}
