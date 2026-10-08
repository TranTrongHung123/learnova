package com.learnova.notification.repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class NotificationDelivery {

    private final JdbcClient jdbc;

    public NotificationDelivery(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // UNION loại trùng người thuộc nhiều lớp; PUBLIC không có tập người nhận cố định.
    private static final String RECIPIENTS = """
    with recipients as (
        select s.id session_id, i.user_id from exam_sessions s
        join session_individual_assignments i on i.session_id=s.id where s.access_type='INDIVIDUAL'
        union
        select s.id, m.user_id from exam_sessions s
        join session_class_assignments c on c.session_id=s.id
        join classroom_memberships m on m.classroom_id=c.classroom_id and m.status='ACTIVE'
        where s.access_type='CLASS'
    ), eligible as (
        select r.* from recipients r join users u on u.id=r.user_id
        where u.status='ACTIVE' and u.onboarding_completed
        and exists(select 1 from user_roles ur where ur.user_id=u.id and ur.role='PARTICIPANT')
    )
    """;
    private static final String INSERT = """
    insert into notifications(id,recipient_id,type,event_key,title,message,target_path,created_at)
    """;

    public void assignments(UUID sessionId, UUID recipientId, Instant now) {
        jdbc.sql(
            RECIPIENTS +
                INSERT +
                """
                select gen_random_uuid(),r.user_id,'EXAM_ASSIGNED',s.id::text,'Bạn được giao kỳ thi',
                    s.title,'/participant/exams/'||s.id,:now
                from eligible r join exam_sessions s on s.id=r.session_id
                where s.status in ('SCHEDULED','OPEN') and s.end_time>:now
                and (cast(:session as uuid) is null or s.id=:session)
                and (cast(:recipient as uuid) is null or r.user_id=:recipient)
                order by s.id,r.user_id
                on conflict(type,event_key,recipient_id) do nothing
                """
        )
            .param("session", sessionId)
            .param("recipient", recipientId)
            .param("now", Timestamp.from(now))
            .update();
    }

    public void reminders(Instant now) {
        jdbc.sql(
            RECIPIENTS +
                INSERT +
                """
                select gen_random_uuid(),r.user_id,'EXAM_REMINDER',s.id::text,'Kỳ thi sắp bắt đầu',
                    s.title,'/participant/exams/'||s.id,:now
                from eligible r join exam_sessions s on s.id=r.session_id
                join notifications n on n.type='EXAM_ASSIGNED' and n.event_key=s.id::text and n.recipient_id=r.user_id
                where s.status='SCHEDULED' and s.start_time>:now and s.start_time-interval '24 hours'<=:now
                and s.scheduled_at<=s.start_time-interval '24 hours'
                and n.created_at<s.start_time-interval '24 hours'
                order by s.id,r.user_id
                on conflict(type,event_key,recipient_id) do nothing
                """
        )
            .param("now", Timestamp.from(now))
            .update();
    }

    public void results(Instant now) {
        // Predicate đối chiếu ResultVisibility: không mang điểm/đáp án vào payload.
        jdbc.sql(
            INSERT +
                """
                select gen_random_uuid(),a.participant_id,'RESULT_RELEASED',a.id::text,'Kết quả đã sẵn sàng',
                    s.title,'/participant/results/'||a.id,:now
                from attempts a join attempt_results result on result.attempt_id=a.id
                join exam_sessions s on s.id=a.session_id join users u on u.id=a.participant_id
                where a.status='GRADED' and u.status='ACTIVE' and u.onboarding_completed
                and exists(select 1 from user_roles ur where ur.user_id=u.id and ur.role='PARTICIPANT')
                and s.result_display_mode<>'HIDDEN'
                and (s.result_release_policy='IMMEDIATE'
                    or (s.result_release_policy='AFTER_SESSION_END' and s.end_time<=:now)
                    or (s.result_release_policy='MANUAL' and s.results_released_at is not null))
                and not exists(select 1 from notifications n where n.type='RESULT_RELEASED' and n.event_key=a.id::text and n.recipient_id=a.participant_id)
                order by a.id
                limit 500
                on conflict(type,event_key,recipient_id) do nothing
                """
        )
            .param("now", Timestamp.from(now))
            .update();
    }

    public void joined(UUID classroom, UUID user, String eventKey, Instant now) {
        jdbc.sql(
            INSERT +
                """
                select gen_random_uuid(),r.id,'CLASS_JOINED',:event,'Thành viên tham gia lớp',
                    c.name,case when r.id=c.owner_id then '/creator/classes/'||c.id else '/participant/classes' end,:now
                from classrooms c join users r on r.id in (c.owner_id,:user)
                where c.id=:classroom
                on conflict(type,event_key,recipient_id) do nothing
                """
        )
            .param("event", eventKey)
            .param("user", user)
            .param("classroom", classroom)
            .param("now", Timestamp.from(now))
            .update();
    }
}
