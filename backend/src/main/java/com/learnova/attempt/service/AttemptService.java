package com.learnova.attempt.service;

import com.learnova.attempt.dto.AttemptDtos.*;
import com.learnova.attempt.exception.AttemptFailure;
import com.learnova.attempt.repository.AttemptRepository;
import com.learnova.attempt.repository.AttemptRepository.Attempt;
import com.learnova.exam.service.ExamService;
import com.learnova.identity.service.IdentityService;
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
public class AttemptService {

    private final AttemptRepository attempts;
    private final SessionAdmission admission;
    private final IdentityService identity;
    private final ExamService exams;
    private final Clock clock;
    private final AttemptFinalization finalization;
    private final org.springframework.transaction.support.TransactionTemplate transaction;

    public AttemptService(
        AttemptRepository attempts,
        SessionAdmission admission,
        IdentityService identity,
        ExamService exams,
        Clock clock,
        AttemptFinalization finalization,
        org.springframework.transaction.PlatformTransactionManager manager
    ) {
        this.attempts = attempts;
        this.admission = admission;
        this.identity = identity;
        this.exams = exams;
        this.clock = clock;
        this.finalization = finalization;
        this.transaction = new org.springframework.transaction.support.TransactionTemplate(manager);
    }

    @Transactional
    public Started start(UUID actor, UUID session) {
        authorize(actor);
        admission.lock(session);
        var active = attempts.active(actor, session);
        // Assignment chỉ áp dụng cho lượt mới; retry/Resume vẫn giữ bài đã bắt đầu.
        if (active.isPresent()) return new Started(
            false,
            view(finalization.finish(owned(actor, active.get(), true), false), now())
        );
        var reserved = admission.reserve(actor, session);
        int used = attempts.count(actor, session);
        if (used >= reserved.maxAttempts()) throw new AttemptFailure(409, "ATTEMPTS_EXHAUSTED");
        UUID id = UUID.randomUUID();
        attempts.create(
            id,
            actor,
            session,
            reserved.versionId(),
            used + 1,
            reserved.startedAt(),
            reserved.deadline()
        );
        attempts.seen(id, now());
        var questions = new ArrayList<>(exams.takingQuestions(reserved.versionId()));
        if (reserved.shuffleQuestions()) Collections.shuffle(questions);
        for (int i = 0; i < questions.size(); i++) {
            var q = questions.get(i);
            var options = new ArrayList<>(
                q.options().stream().map(ExamService.TakingOption::id).toList()
            );
            if (reserved.shuffleAnswers()) Collections.shuffle(options);
            attempts.addQuestion(id, reserved.versionId(), q.id(), i, options);
        }
        return new Started(true, view(owned(actor, id, false), now()));
    }

    @Transactional
    public View read(UUID actor, UUID id) {
        authorize(actor);
        return view(finalization.finish(owned(actor, id, true), false), now());
    }

    @Transactional
    public View submit(UUID actor, UUID id) {
        authorize(actor);
        return view(finalization.finish(owned(actor, id, true), true), now());
    }

    @Transactional
    public void heartbeat(UUID actor, UUID id) {
        authorize(actor);
        var attempt = owned(actor, id, true);
        if (
            attempt.status().equals("IN_PROGRESS") && now().isBefore(attempt.deadline())
        ) attempts.seen(id, now());
    }

    public Saved save(UUID actor, UUID id, UUID questionId, Save input) {
        Saved result = transaction.execute(status -> saveLocked(actor, id, questionId, input));
        // Finalize do deadline phải commit trước khi báo autosave đến muộn.
        if (result == null) throw new AttemptFailure(409, "ATTEMPT_DEADLINE_PASSED");
        return result;
    }

    private Saved saveLocked(UUID actor, UUID id, UUID questionId, Save input) {
        authorize(actor);
        var attempt = owned(actor, id, true);
        Instant time = now();
        if (!attempt.status().equals("IN_PROGRESS")) throw new AttemptFailure(
            409,
            "ATTEMPT_NOT_EDITABLE"
        );
        if (!time.isBefore(attempt.deadline())) {
            finalization.finish(attempt, false);
            return null;
        }
        var state = attempts
            .entries(id)
            .stream()
            .filter(e -> e.questionId().equals(questionId))
            .findFirst()
            .orElseThrow(() -> new AttemptFailure(404, "ATTEMPT_QUESTION_NOT_FOUND"))
            .state();
        if (input.revision() != state.revision()) throw new AttemptFailure(
            409,
            "ANSWER_REVISION_CONFLICT"
        );
        var question = exams
            .takingQuestions(attempt.versionId())
            .stream()
            .filter(q -> q.id().equals(questionId))
            .findFirst()
            .orElseThrow();
        validate(question, input.answer());
        Long activeTime = state.activeTimeMs();
        if (input.activeTimeMs() != null) {
            long elapsed = Math.max(0, Duration.between(attempt.startedAt(), time).toMillis());
            activeTime = Math.max(
                activeTime == null ? 0 : activeTime,
                Math.min(input.activeTimeMs(), elapsed)
            );
        }
        attempts.save(id, questionId, input, activeTime, time);
        attempts.seen(id, time);
        return new Saved(
            new State(
                questionId,
                input.answer(),
                input.markedForReview(),
                state.revision() + 1,
                activeTime,
                time
            ),
            time
        );
    }

    private View view(Attempt a, Instant time) {
        boolean editable = a.status().equals("IN_PROGRESS") && time.isBefore(a.deadline());
        List<Question> questions = List.of();
        if (editable) {
            var source = exams
                .takingQuestions(a.versionId())
                .stream()
                .collect(Collectors.toMap(ExamService.TakingQuestion::id, Function.identity()));
            questions = attempts
                .entries(a.id())
                .stream()
                .map(e -> {
                    var q = source.get(e.questionId());
                    var options = q
                        .options()
                        .stream()
                        .collect(
                            Collectors.toMap(ExamService.TakingOption::id, Function.identity())
                        );
                    return new Question(
                        q.id(),
                        q.type(),
                        q.content(),
                        e
                            .optionOrder()
                            .stream()
                            .map(id -> new Option(id, options.get(id).content()))
                            .toList(),
                        e.state()
                    );
                })
                .toList();
        }
        return new View(
            a.id(),
            a.sessionId(),
            a.versionId(),
            a.title(),
            a.number(),
            a.status(),
            a.startedAt(),
            a.deadline(),
            time,
            editable,
            questions,
            a.completionReason(),
            a.submittedAt(),
            a.gradedAt()
        );
    }

    private void validate(ExamService.TakingQuestion q, Answer answer) {
        var ids = answer.optionIds();
        var allowed = q
            .options()
            .stream()
            .map(ExamService.TakingOption::id)
            .collect(Collectors.toSet());
        boolean valid = new HashSet<>(ids).size() == ids.size() && allowed.containsAll(ids);
        valid &= switch (q.type()) {
            case "SINGLE_CHOICE" -> ids.size() <= 1 &&
                answer.booleanValue() == null &&
                answer.numericValue() == null;
            case "MULTIPLE_CHOICE" -> answer.booleanValue() == null &&
                answer.numericValue() == null;
            case "TRUE_FALSE" -> ids.isEmpty() && answer.numericValue() == null;
            case "NUMERIC_ANSWER" -> ids.isEmpty() &&
                answer.booleanValue() == null &&
                numeric(answer.numericValue());
            default -> false;
        };
        if (!valid) throw new AttemptFailure(400, "INVALID_ATTEMPT_ANSWER");
    }

    private boolean numeric(String value) {
        if (value == null) return true;
        if (value.length() > 42 || !value.matches("-?\\d+(\\.\\d+)?")) return false;
        var number = new BigDecimal(value);
        return number.scale() <= 10 && number.precision() - number.scale() <= 20;
    }

    private Attempt owned(UUID actor, UUID id, boolean lock) {
        return attempts
            .owned(actor, id, lock)
            .orElseThrow(() -> new AttemptFailure(404, "ATTEMPT_NOT_FOUND"));
    }

    private void authorize(UUID actor) {
        if (!identity.activeUser(actor).roles().contains("PARTICIPANT")) throw new AttemptFailure(
            403,
            "FORBIDDEN"
        );
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }
}
