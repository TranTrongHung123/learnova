package com.learnova.question.service;

import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditService;
import com.learnova.identity.service.IdentityService;
import com.learnova.question.dto.QuestionDtos.*;
import com.learnova.question.entity.Question;
import com.learnova.question.enums.*;
import com.learnova.question.exception.QuestionFailure;
import com.learnova.question.repository.QuestionRepository;
import com.learnova.shared.api.*;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.*;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true)
public class QuestionService {
    private final QuestionRepository repository;
    private final QuestionValidation validation;
    private final IdentityService identity;
    private final AuditService audit;
    private final Clock clock;
    public QuestionService(QuestionRepository repository, QuestionValidation validation, IdentityService identity, AuditService audit, Clock clock) {
        this.repository = repository; this.validation = validation; this.identity = identity; this.audit = audit; this.clock = clock;
    }
    public PageResponse<Summary> list(UUID actor, String keyword, QuestionType type, Difficulty difficulty, String tag, String category, QuestionStatus status, PageQuery page) {
        authorize(actor);
        var result = repository.findAll((root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("ownerId"), actor));
            predicates.add(status == null ? root.get("status").in(QuestionStatus.DRAFT, QuestionStatus.ACTIVE) : cb.equal(root.get("status"), status));
            if (type != null) predicates.add(cb.equal(root.get("type"), type));
            if (difficulty != null) predicates.add(cb.equal(root.get("difficulty"), difficulty));
            if (tag != null && !tag.isBlank()) predicates.add(cb.isMember(tag.strip(), root.get("tags")));
            if (category != null && !category.isBlank()) predicates.add(cb.equal(cb.lower(root.get("category")), category.strip().toLowerCase(Locale.ROOT)));
            if (keyword != null && !keyword.isBlank()) {
                String escaped = keyword.strip().toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_");
                predicates.add(cb.like(cb.lower(root.get("content")), "%" + escaped + "%", '!'));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        }, page.toPageable(Sort.by(Sort.Direction.DESC, "updatedAt", "id")));
        return PageResponse.from(result.map(q -> new Summary(q.getId(), q.getType(), q.getStatus(),
                q.getContent().substring(0, Math.min(240, q.getContent().length())), q.getDifficulty(), q.getCategory(), tags(q), q.getRevision(), q.getUpdatedAt())));
    }
    public Detail detail(UUID actor, UUID id) { return view(owned(actor, id, false)); }
    // Giữ khóa nguồn tới khi transaction tạo snapshot hoàn tất, tránh nội dung/lựa chọn lệch revision.
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public Detail copyActiveForExam(UUID actor, UUID id, long expectedRevision) {
        var question = owned(actor, id, true);
        revision(question, expectedRevision);
        if (question.getStatus() != QuestionStatus.ACTIVE) throw new QuestionFailure(409, "QUESTION_STATE_CONFLICT");
        return view(question);
    }
    @Transactional
    public Detail create(UUID actor, WriteQuestion input) {
        authorize(actor);
        if (input.revision() != null) throw new QuestionFailure(400, "INVALID_REQUEST");
        var numbers = validation.validate(input);
        var question = new Question(actor, clock.instant());
        question.write(input, numbers.value(), numbers.tolerance(), clock.instant());
        repository.save(question); record(actor, question, AuditAction.QUESTION_CREATED);
        return view(question);
    }
    @Transactional
    public Detail update(UUID actor, UUID id, WriteQuestion input) {
        var question = owned(actor, id, true); revision(question, input.revision());
        if (question.getStatus() == QuestionStatus.ARCHIVED || (question.getStatus() == QuestionStatus.ACTIVE && input.status() == QuestionStatus.DRAFT))
            throw new QuestionFailure(409, "QUESTION_STATE_CONFLICT");
        var numbers = validation.validate(input);
        question.write(input, numbers.value(), numbers.tolerance(), clock.instant());
        record(actor, question, AuditAction.QUESTION_UPDATED);
        return view(question);
    }
    @Transactional
    public Detail archive(UUID actor, UUID id, long revision) {
        var question = owned(actor, id, true); revision(question, revision);
        if (question.getStatus() != QuestionStatus.ARCHIVED) {
            question.transition(QuestionStatus.ARCHIVED, clock.instant()); record(actor, question, AuditAction.QUESTION_ARCHIVED);
        }
        return view(question);
    }
    @Transactional
    public Detail restore(UUID actor, UUID id, long revision) {
        var question = owned(actor, id, true); revision(question, revision);
        if (question.getStatus() != QuestionStatus.ARCHIVED) throw new QuestionFailure(409, "QUESTION_STATE_CONFLICT");
        var detail = view(question);
        var candidate = new WriteQuestion(detail.type(), QuestionStatus.ACTIVE, detail.content(), detail.explanation(), detail.difficulty(),
                detail.category(), detail.tags(), detail.options(), detail.correctBoolean(), detail.correctValue(), detail.tolerance(), null);
        QuestionStatus next = QuestionStatus.ACTIVE;
        try { validation.validate(candidate); } catch (QuestionFailure failure) { next = QuestionStatus.DRAFT; }
        question.transition(next, clock.instant()); record(actor, question, AuditAction.QUESTION_RESTORED);
        return view(question);
    }
    private void authorize(UUID actor) {
        if (!identity.activeUser(actor).roles().contains("CREATOR")) throw new QuestionFailure(403, "FORBIDDEN");
    }
    private Question owned(UUID actor, UUID id, boolean lock) {
        authorize(actor);
        return (lock ? repository.lockOwned(id, actor) : repository.findByIdAndOwnerId(id, actor))
                .orElseThrow(() -> new QuestionFailure(404, "QUESTION_NOT_FOUND"));
    }
    private void revision(Question question, Long revision) {
        if (revision == null || revision < 0) throw new QuestionFailure(400, "VALIDATION_FAILED", List.of(new ApiProblems.FieldError("revision", "Revision bắt buộc và không âm.")));
        if (question.getRevision() != revision) throw new QuestionFailure(409, "QUESTION_REVISION_CONFLICT");
    }
    private void record(UUID actor, Question question, AuditAction action) {
        audit.record(actor.toString(), action, "QUESTION", question.getId().toString(), Map.of("status", question.getStatus().name(), "revision", Long.toString(question.getRevision())));
    }
    private List<String> tags(Question question) { return question.getTags().stream().sorted().toList(); }
    private String decimal(BigDecimal value) { return value == null ? null : value.stripTrailingZeros().toPlainString(); }
    private Detail view(Question q) {
        return new Detail(q.getId(), q.getType(), q.getStatus(), q.getContent(), q.getExplanation(), q.getDifficulty(), q.getCategory(), tags(q),
                q.getOptions().stream().map(o -> new Option(o.getContent(), o.isCorrect())).toList(), q.getCorrectBoolean(), decimal(q.getCorrectValue()),
                decimal(q.getTolerance()), q.getRevision(), q.getCreatedAt(), q.getUpdatedAt());
    }
}
