package com.learnova.session.service;

import com.learnova.identity.service.IdentityService;
import com.learnova.session.enums.*;
import com.learnova.session.exception.SessionFailure;
import com.learnova.session.repository.SessionRepository;
import java.time.*;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** F13 gọi trong transaction tạo Attempt; khóa được giữ đến khi transaction đó kết thúc. */
@Service
public class SessionAdmission {
    private final SessionRepository sessions;
    private final IdentityService identity;
    private final JdbcClient jdbc;
    private final Clock clock;
    public SessionAdmission(SessionRepository sessions, IdentityService identity, JdbcClient jdbc, Clock clock) {
        this.sessions=sessions; this.identity=identity; this.jdbc=jdbc; this.clock=clock;
    }
    public record Admission(UUID versionId, Instant startedAt, Instant deadline, int maxAttempts, boolean shuffleQuestions, boolean shuffleAnswers) {}
    @Transactional(propagation=Propagation.MANDATORY)
    public Admission reserve(UUID participant, UUID sessionId) {
        if (!identity.activeUser(participant).roles().contains("PARTICIPANT")) throw new SessionFailure(403,"FORBIDDEN");
        var s=sessions.lockById(sessionId).orElseThrow(()->new SessionFailure(404,"SESSION_NOT_FOUND"));
        Instant now=clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        if (s.effectiveStatus(now)!=SessionStatus.OPEN) throw new SessionFailure(409,"SESSION_INVALID_STATE");
        boolean allowed=switch(s.getAccessType()) {
            case PUBLIC -> true;
            case INDIVIDUAL -> s.getParticipantIds().contains(participant);
            case CLASS -> jdbc.sql("""
                select exists(select 1 from classroom_memberships m join session_class_assignments a on a.classroom_id=m.classroom_id
                where a.session_id=:session and m.user_id=:participant and m.status='ACTIVE')
                """).param("session",sessionId).param("participant",participant).query(Boolean.class).single();
        };
        if (!allowed) throw new SessionFailure(403,"SESSION_NOT_ASSIGNED");
        // Không có transaction độc lập: tạo Attempt thất bại phải rollback dấu bắt đầu này.
        s.advance(now); s.markFirstAttempt(now);
        var durationDeadline=now.plusSeconds((long)s.getDurationMinutes()*60);
        return new Admission(s.getExamVersionId(),now,durationDeadline.isBefore(s.getEndTime())?durationDeadline:s.getEndTime(),
                s.getMaxAttempts(),s.isShuffleQuestions(),s.isShuffleAnswers());
    }
}
