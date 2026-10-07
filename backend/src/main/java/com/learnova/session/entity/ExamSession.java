package com.learnova.session.entity;

import com.learnova.session.dto.SessionDtos.WriteSession;
import com.learnova.session.enums.*;
import com.learnova.session.enums.AccessType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import lombok.Getter;

@Entity @Table(name="exam_sessions") @Getter
public class ExamSession {
    @Id private UUID id;
    @Column(nullable=false) private UUID ownerId;
    @Column(nullable=false) private UUID examId;
    @Column(nullable=false) private UUID examVersionId;
    @Column(nullable=false, length=200) private String title;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=16) private SessionStatus status;
    @Column(nullable=false) private Instant startTime;
    @Column(nullable=false) private Instant endTime;
    @Column(nullable=false) private int durationMinutes;
    @Column(nullable=false) private int maxAttempts;
    @Column(nullable=false, precision=30, scale=10) private BigDecimal passingScore;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=16) private AccessType accessType;
    @Column(nullable=false) private boolean shuffleQuestions;
    @Column(nullable=false) private boolean shuffleAnswers;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=16) private ResultDisplayMode resultDisplayMode;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=24) private ResultReleasePolicy resultReleasePolicy;
    private Instant firstAttemptAt;
    private Instant resultsReleasedAt;
    private Instant scheduledAt;
    @Column(nullable=false) private long revision;
    @Column(nullable=false) private Instant createdAt;
    @Column(nullable=false) private Instant updatedAt;
    @ElementCollection @CollectionTable(name="session_class_assignments", joinColumns=@JoinColumn(name="session_id"))
    @Column(name="classroom_id", nullable=false) private Set<UUID> classroomIds = new HashSet<>();
    @ElementCollection @CollectionTable(name="session_individual_assignments", joinColumns=@JoinColumn(name="session_id"))
    @Column(name="user_id", nullable=false) private Set<UUID> participantIds = new HashSet<>();
    protected ExamSession() {}
    public ExamSession(UUID owner, UUID exam, WriteSession input, BigDecimal score, Instant now) {
        id = UUID.randomUUID(); ownerId = owner; status = SessionStatus.DRAFT;
        createdAt = now; updatedAt = now; configure(exam, input, score);
    }
    public void configure(UUID exam, WriteSession i, BigDecimal score) {
        examId=exam; examVersionId=i.examVersionId(); title=i.title().strip(); startTime=i.startTime(); endTime=i.endTime();
        durationMinutes=i.durationMinutes(); maxAttempts=i.maxAttempts(); passingScore=score; accessType=i.accessType();
        classroomIds.clear(); classroomIds.addAll(i.classroomIds()); participantIds.clear(); participantIds.addAll(i.participantIds());
        shuffleQuestions=i.shuffleQuestions(); shuffleAnswers=i.shuffleAnswers();
        resultDisplayMode=i.resultDisplayMode(); resultReleasePolicy=i.resultReleasePolicy();
    }
    public SessionStatus effectiveStatus(Instant now) {
        if (status != SessionStatus.SCHEDULED && status != SessionStatus.OPEN) return status;
        if (!now.isBefore(endTime)) return SessionStatus.CLOSED;
        return now.isBefore(startTime) ? SessionStatus.SCHEDULED : SessionStatus.OPEN;
    }
    public void advance(Instant now) { var effective=effectiveStatus(now); if (status!=effective) { status=effective; touch(now); } }
    public void schedule(Instant now) { scheduledAt=now; status=SessionStatus.SCHEDULED; status=effectiveStatus(now); touch(now); }
    public void cancel(Instant now) { status=SessionStatus.CANCELLED; touch(now); }
    public void rename(String value) { title=value.strip(); }
    public void extend(Instant value, Instant now) { endTime=value; touch(now); }
    public void touch(Instant now) { revision++; updatedAt=now; }
    public void releaseResults(Instant now) { resultsReleasedAt=now; touch(now); }
    public void markFirstAttempt(Instant now) { if (firstAttemptAt==null) { firstAttemptAt=now; touch(now); } }
}
