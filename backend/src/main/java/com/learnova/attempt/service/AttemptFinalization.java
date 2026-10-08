package com.learnova.attempt.service;

import com.learnova.attempt.repository.AttemptRepository;
import com.learnova.attempt.repository.AttemptRepository.Attempt;
import com.learnova.exam.service.ExamService;
import com.learnova.session.service.SessionAdmission;
import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class AttemptFinalization {

    private final AttemptRepository attempts;
    private final ExamService exams;
    private final SessionAdmission sessions;
    private final AutomaticGrading grading;
    private final Clock clock;

    public AttemptFinalization(
        AttemptRepository attempts,
        ExamService exams,
        SessionAdmission sessions,
        AutomaticGrading grading,
        Clock clock
    ) {
        this.attempts = attempts;
        this.exams = exams;
        this.sessions = sessions;
        this.grading = grading;
        this.clock = clock;
    }

    @Transactional
    public void expire(UUID id) {
        attempts.lock(id).ifPresent(a -> finish(a, false));
    }

    // Caller giữ khóa Attempt đến commit; autosave cũng bắt buộc lấy khóa này.
    @Transactional(propagation = Propagation.MANDATORY)
    public Attempt finish(Attempt a, boolean submit) {
        if (!a.status().equals("IN_PROGRESS")) return a;
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        boolean expired = !now.isBefore(a.deadline());
        if (!submit && !expired) return a;
        var questions = exams.gradingQuestions(a.versionId());
        var answers = attempts
            .entries(a.id())
            .stream()
            .collect(Collectors.toMap(AttemptRepository.Entry::questionId, Function.identity()));
        if (
            questions.isEmpty() ||
            !answers
                .keySet()
                .equals(
                    questions
                        .stream()
                        .map(ExamService.GradingQuestion::id)
                        .collect(Collectors.toSet())
                )
        ) throw new IllegalStateException("Attempt snapshot is incomplete");
        var correct = new HashMap<UUID, Boolean>();
        BigDecimal raw = BigDecimal.ZERO,
            total = BigDecimal.ZERO;
        for (var q : questions) {
            boolean matched = grading.correct(q, answers.get(q.id()).state().answer());
            correct.put(q.id(), matched);
            total = total.add(q.points());
            if (matched) raw = raw.add(q.points());
        }
        var passing = sessions.passingScore(a.sessionId());
        attempts.result(a.id(), raw, total, passing, grading.passed(raw, passing), now);
        for (var q : questions)
            attempts.resultQuestion(a.id(), q.id(), correct.get(q.id()), q.points());
        attempts.complete(
            a.id(),
            expired ? "DEADLINE_REACHED" : "PARTICIPANT_SUBMIT",
            expired ? a.deadline() : now,
            now
        );
        return attempts.lock(a.id()).orElseThrow();
    }
}
