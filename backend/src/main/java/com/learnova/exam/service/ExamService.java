package com.learnova.exam.service;

import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditService;
import com.learnova.exam.dto.ExamDtos.*;
import com.learnova.exam.entity.*;
import com.learnova.exam.enums.*;
import com.learnova.exam.exception.ExamFailure;
import com.learnova.exam.repository.*;
import com.learnova.identity.service.IdentityService;
import com.learnova.question.dto.QuestionDtos;
import com.learnova.question.enums.QuestionStatus;
import com.learnova.question.exception.QuestionFailure;
import com.learnova.question.service.QuestionService;
import com.learnova.question.service.QuestionValidation;
import com.learnova.shared.api.*;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ExamService {

    private final ExamRepository exams;
    private final ExamVersionRepository versions;
    private final QuestionService questions;
    private final QuestionValidation validation;
    private final IdentityService identity;
    private final AuditService audit;
    private final Clock clock;

    public ExamService(
        ExamRepository exams,
        ExamVersionRepository versions,
        QuestionService questions,
        QuestionValidation validation,
        IdentityService identity,
        AuditService audit,
        Clock clock
    ) {
        this.exams = exams;
        this.versions = versions;
        this.questions = questions;
        this.validation = validation;
        this.identity = identity;
        this.audit = audit;
        this.clock = clock;
    }

    public PageResponse<ExamSummary> list(
        UUID actor,
        String keyword,
        ExamStatus status,
        PageQuery page
    ) {
        authorize(actor);
        var result = exams.findAll(
            (root, query, cb) -> {
                var owner = cb.equal(root.get("ownerId"), actor);
                var state = cb.equal(
                    root.get("status"),
                    status == null ? ExamStatus.ACTIVE : status
                );
                String escaped = keyword
                    .strip()
                    .toLowerCase(Locale.ROOT)
                    .replace("!", "!!")
                    .replace("%", "!%")
                    .replace("_", "!_");
                return cb.and(
                    owner,
                    state,
                    cb.like(cb.lower(root.get("name")), "%" + escaped + "%", '!')
                );
            },
            page.toPageable(Sort.by(Sort.Direction.DESC, "updatedAt", "id"))
        );
        return PageResponse.from(
            result.map(e ->
                new ExamSummary(
                    e.getId(),
                    e.getName(),
                    e.getStatus(),
                    e.getRevision(),
                    versions
                        .findFirstByExamIdOrderByVersionNumberDesc(e.getId())
                        .map(this::summary)
                        .orElse(null),
                    e.getUpdatedAt()
                )
            )
        );
    }

    public ExamDetail detail(UUID actor, UUID id) {
        return view(owned(actor, id, false));
    }

    public record SessionVersion(
        UUID examId,
        UUID versionId,
        String examName,
        int versionNumber,
        int questionCount,
        String totalScore
    ) {}

    public record TakingOption(UUID id, String content) {}

    public record TakingQuestion(
        UUID id,
        String type,
        String content,
        List<TakingOption> options
    ) {}

    public record GradingQuestion(
        UUID id,
        String type,
        BigDecimal points,
        Set<UUID> correctOptions,
        Boolean correctBoolean,
        BigDecimal correctValue,
        BigDecimal tolerance
    ) {}

    // Chỉ dùng nội bộ khi finalize; tuyệt đối không serialize sang API làm bài.
    public List<GradingQuestion> gradingQuestions(UUID versionId) {
        var version = versions.findById(versionId).orElseThrow(ExamService::missingVersion);
        if (version.getStatus() != VersionStatus.PUBLISHED) throw new ExamFailure(
            409,
            "EXAM_VERSION_NOT_PUBLISHED"
        );
        return ordered(version)
            .stream()
            .map(q -> {
                var s = q.getSnapshot();
                return new GradingQuestion(
                    q.getId(),
                    s.type().name(),
                    q.getPoints(),
                    s
                        .options()
                        .stream()
                        .filter(SnapshotOption::correct)
                        .map(SnapshotOption::id)
                        .collect(java.util.stream.Collectors.toUnmodifiableSet()),
                    s.correctBoolean(),
                    s.correctValue() == null ? null : new BigDecimal(s.correctValue()),
                    s.tolerance() == null ? BigDecimal.ZERO : new BigDecimal(s.tolerance())
                );
            })
            .toList();
    }

    // Contract nội bộ: caller đã kiểm tra quyền Attempt; không truyền dữ liệu chấm điểm.
    public List<TakingQuestion> takingQuestions(UUID versionId) {
        var version = versions.findById(versionId).orElseThrow(ExamService::missingVersion);
        if (version.getStatus() != VersionStatus.PUBLISHED) throw new ExamFailure(
            409,
            "EXAM_VERSION_NOT_PUBLISHED"
        );
        return version
            .getQuestions()
            .stream()
            .sorted(Comparator.comparingInt(ExamVersionQuestion::getPosition))
            .map(q ->
                new TakingQuestion(
                    q.getId(),
                    q.getSnapshot().type().name(),
                    q.getSnapshot().content(),
                    q
                        .getSnapshot()
                        .options()
                        .stream()
                        .map(o -> new TakingOption(o.id(), o.content()))
                        .toList()
                )
            )
            .toList();
    }

    @Transactional
    public SessionVersion requireSessionVersion(UUID actor, UUID id) {
        var exam = versionOwner(actor, id, true);
        if (exam.getStatus() == ExamStatus.ARCHIVED) throw new ExamFailure(409, "EXAM_ARCHIVED");
        var version = versions.findById(id).orElseThrow(ExamService::missingVersion);
        if (version.getStatus() != VersionStatus.PUBLISHED) throw new ExamFailure(
            409,
            "EXAM_VERSION_NOT_PUBLISHED"
        );
        return new SessionVersion(
            exam.getId(),
            id,
            exam.getName(),
            version.getVersionNumber(),
            version.getQuestions().size(),
            total(version)
        );
    }

    public VersionDetail version(UUID actor, UUID id) {
        var exam = versionOwner(actor, id, false);
        return view(exam, versions.findById(id).orElseThrow(ExamService::missingVersion));
    }

    @Transactional
    public ExamDetail create(UUID actor, CreateExam input) {
        authorize(actor);
        var exam = exams.save(new Exam(actor, input.name(), input.description(), clock.instant()));
        var version = versions.save(new ExamVersion(exam.getId(), 1, clock.instant()));
        record(actor, AuditAction.EXAM_CREATED, "EXAM", exam.getId(), Map.of());
        record(
            actor,
            AuditAction.EXAM_VERSION_CREATED,
            "EXAM_VERSION",
            version.getId(),
            Map.of("version", "1")
        );
        return view(exam);
    }

    @Transactional
    public ExamDetail archive(UUID actor, UUID id, long revision) {
        var exam = owned(actor, id, true);
        if (exam.getStatus() == ExamStatus.ARCHIVED) return view(exam);
        checkRevision(exam.getRevision(), revision);
        exam.archive(clock.instant());
        record(actor, AuditAction.EXAM_ARCHIVED, "EXAM", id, Map.of());
        return view(exam);
    }

    @Transactional
    public VersionDetail createVersion(UUID actor, UUID id, NewVersion input) {
        // Mọi mutation khóa Exam trước Version; cấp số và sao chép cùng một transaction.
        var exam = owned(actor, id, true);
        var base =
            input.baseVersionId() == null
                ? null
                : versions
                      .findByIdAndExamId(input.baseVersionId(), id)
                      .orElseThrow(ExamService::missingVersion);
        if (base != null && base.getStatus() != VersionStatus.PUBLISHED) throw new ExamFailure(
            409,
            "EXAM_BASE_NOT_PUBLISHED"
        );
        int number = versions
            .findFirstByExamIdOrderByVersionNumberDesc(id)
            .map(v -> Math.addExact(v.getVersionNumber(), 1))
            .orElse(1);
        var next = new ExamVersion(id, number, clock.instant());
        if (base != null) for (var q : ordered(base)) {
            next.add(
                new ExamVersionQuestion(
                    next,
                    q.getSourceQuestionId(),
                    q.getSourceRevision(),
                    q.getPosition(),
                    q.getPoints(),
                    copy(q.getSnapshot())
                )
            );
        }
        versions.save(next);
        exam.touch(clock.instant());
        record(
            actor,
            AuditAction.EXAM_VERSION_CREATED,
            "EXAM_VERSION",
            next.getId(),
            Map.of("version", Integer.toString(number))
        );
        return view(exam, next);
    }

    @Transactional
    public VersionDetail add(UUID actor, UUID id, AddQuestions input) {
        var exam = versionOwner(actor, id, true);
        var version = lockedDraft(id, input.revision());
        append(actor, version, input.questions());
        version.touch(clock.instant());
        exam.touch(clock.instant());
        return view(exam, version);
    }

    @Transactional
    public MatrixPreview previewMatrix(UUID actor, UUID id, MatrixRequest input) {
        versionOwner(actor, id, true);
        var version = lockedDraft(id, input.revision());
        var allocation = allocate(actor, version, input, false);
        return new MatrixPreview(
            version.getRevision(),
            allocation.complete(),
            allocation.availability()
        );
    }

    @Transactional
    public VersionDetail generate(UUID actor, UUID id, MatrixRequest input) {
        var exam = versionOwner(actor, id, true);
        var version = lockedDraft(id, input.revision());
        var allocation = allocate(actor, version, input, true);
        if (!allocation.complete()) {
            throw new ExamFailure(
                409,
                "EXAM_MATRIX_INSUFFICIENT_CANDIDATES",
                List.of(),
                new MatrixPreview(version.getRevision(), false, allocation.availability())
            );
        }
        var selected = allocation
            .selected()
            .stream()
            .flatMap(List::stream)
            .map(q -> new Source(q.id(), q.revision()))
            .toList();
        append(actor, version, selected);
        version.touch(clock.instant());
        exam.touch(clock.instant());
        return view(exam, version);
    }

    private MatrixAllocator.Allocation allocate(
        UUID actor,
        ExamVersion version,
        MatrixRequest input,
        boolean randomize
    ) {
        long requested = input.rules().stream().mapToLong(MatrixRule::quantity).sum();
        if (requested > 500) throw new ExamFailure(
            400,
            "VALIDATION_FAILED",
            List.of(new ApiProblems.FieldError("rules", "Mỗi lần sinh tối đa 500 câu hỏi."))
        );
        var excluded = version
            .getQuestions()
            .stream()
            .map(ExamVersionQuestion::getSourceQuestionId)
            .collect(Collectors.toSet());
        var pools = input
            .rules()
            .stream()
            .map(rule ->
                questions
                    .examCandidates(actor, rule.category(), rule.difficulty(), rule.questionType())
                    .stream()
                    .filter(q -> !excluded.contains(q.id()))
                    .toList()
            )
            .toList();
        return MatrixAllocator.allocate(input.rules(), pools, randomize);
    }

    private void append(UUID actor, ExamVersion version, List<Source> sources) {
        var existing = version
            .getQuestions()
            .stream()
            .map(ExamVersionQuestion::getSourceQuestionId)
            .collect(Collectors.toSet());
        for (var source : sources) {
            if (!existing.add(source.questionId())) throw new ExamFailure(
                400,
                "EXAM_DUPLICATE_QUESTION"
            );
        }
        // Khóa nguồn theo UUID để hai Exam thêm cùng lô câu không deadlock.
        var snapshots = new HashMap<UUID, QuestionDtos.Detail>();
        sources
            .stream()
            .sorted(Comparator.comparing(Source::questionId))
            .forEach(source ->
                snapshots.put(
                    source.questionId(),
                    questions.copyActiveForExam(actor, source.questionId(), source.revision())
                )
            );
        for (var source : sources) {
            var q = snapshots.get(source.questionId());
            var snapshot = new Snapshot(
                q.type(),
                q.content(),
                q.explanation(),
                q.difficulty(),
                q.category(),
                List.copyOf(q.tags()),
                q
                    .options()
                    .stream()
                    .map(o -> new SnapshotOption(UUID.randomUUID(), o.content(), o.correct()))
                    .toList(),
                q.correctBoolean(),
                q.correctValue(),
                q.tolerance()
            );
            version.add(
                new ExamVersionQuestion(
                    version,
                    q.id(),
                    q.revision(),
                    version.getQuestions().size(),
                    BigDecimal.ONE,
                    snapshot
                )
            );
        }
    }

    @Transactional
    public VersionDetail save(UUID actor, UUID id, SaveQuestions input) {
        var exam = versionOwner(actor, id, true);
        var version = lockedDraft(id, input.revision());
        var byId = version
            .getQuestions()
            .stream()
            .collect(Collectors.toMap(ExamVersionQuestion::getId, q -> q));
        var retained = new HashSet<UUID>();
        var points = new ArrayList<BigDecimal>();
        for (int i = 0; i < input.questions().size(); i++) {
            var edit = input.questions().get(i);
            if (!byId.containsKey(edit.id()) || !retained.add(edit.id())) throw new ExamFailure(
                400,
                "EXAM_INVALID_QUESTION_LIST"
            );
            points.add(points(edit.points(), "questions[" + i + "].points"));
        }
        version.retain(retained);
        for (int i = 0; i < input.questions().size(); i++) byId.get(
            input.questions().get(i).id()
        ).configure(i, points.get(i));
        version.touch(clock.instant());
        exam.touch(clock.instant());
        return view(exam, version);
    }

    @Transactional
    public VersionDetail publish(UUID actor, UUID id, long revision) {
        var exam = versionOwner(actor, id, true);
        var version = versions.lockById(id).orElseThrow(ExamService::missingVersion);
        // Retry sau mất response phải trả cùng bản published, không nhân đôi audit.
        if (version.getStatus() == VersionStatus.PUBLISHED) return view(exam, version);
        checkRevision(version.getRevision(), revision);
        if (version.getQuestions().isEmpty()) throw new ExamFailure(400, "EXAM_EMPTY_VERSION");
        for (var q : ordered(version)) {
            points(decimal(q.getPoints()), "questions[" + q.getPosition() + "].points");
            var s = q.getSnapshot();
            try {
                validation.validateComplete(
                    new QuestionDtos.WriteQuestion(
                        s.type(),
                        QuestionStatus.ACTIVE,
                        s.content(),
                        s.explanation(),
                        s.difficulty(),
                        s.category(),
                        s.tags(),
                        s
                            .options()
                            .stream()
                            .map(o -> new QuestionDtos.Option(o.content(), o.correct()))
                            .toList(),
                        s.correctBoolean(),
                        s.correctValue(),
                        s.tolerance(),
                        null
                    )
                );
            } catch (QuestionFailure failure) {
                throw new ExamFailure(
                    400,
                    "EXAM_INVALID_SNAPSHOT",
                    failure.fields
                        .stream()
                        .map(f ->
                            new ApiProblems.FieldError(
                                "questions[" + q.getPosition() + "].snapshot." + f.field(),
                                f.message()
                            )
                        )
                        .toList()
                );
            }
        }
        version.publish(clock.instant());
        exam.touch(clock.instant());
        record(
            actor,
            AuditAction.EXAM_VERSION_PUBLISHED,
            "EXAM_VERSION",
            id,
            Map.of("version", Integer.toString(version.getVersionNumber()))
        );
        return view(exam, version);
    }

    private void authorize(UUID actor) {
        if (!identity.activeUser(actor).roles().contains("CREATOR")) throw new ExamFailure(
            403,
            "FORBIDDEN"
        );
    }

    private Exam owned(UUID actor, UUID id, boolean lock) {
        authorize(actor);
        return (
            lock ? exams.lockOwned(id, actor) : exams.findByIdAndOwnerId(id, actor)
        ).orElseThrow(() -> new ExamFailure(404, "EXAM_NOT_FOUND"));
    }

    private Exam versionOwner(UUID actor, UUID id, boolean lock) {
        authorize(actor);
        return owned(actor, versions.examId(id).orElseThrow(ExamService::missingVersion), lock);
    }

    private ExamVersion lockedDraft(UUID id, long revision) {
        var version = versions.lockById(id).orElseThrow(ExamService::missingVersion);
        version.requireDraft();
        checkRevision(version.getRevision(), revision);
        return version;
    }

    private void checkRevision(long actual, long requested) {
        if (actual != requested) throw new ExamFailure(409, "EXAM_REVISION_CONFLICT");
    }

    private static ExamFailure missingVersion() {
        return new ExamFailure(404, "EXAM_VERSION_NOT_FOUND");
    }

    private BigDecimal points(String raw, String field) {
        if (raw != null && raw.length() <= 42 && raw.matches("\\d+(\\.\\d+)?")) {
            var value = new BigDecimal(raw);
            if (
                value.signum() > 0 && value.scale() <= 10 && value.precision() - value.scale() <= 20
            ) return value;
        }
        throw new ExamFailure(
            400,
            "VALIDATION_FAILED",
            List.of(
                new ApiProblems.FieldError(
                    field,
                    "Điểm phải lớn hơn 0, tối đa 20 chữ số phần nguyên và 10 chữ số thập phân; dùng dấu chấm."
                )
            )
        );
    }

    private Snapshot copy(Snapshot s) {
        return new Snapshot(
            s.type(),
            s.content(),
            s.explanation(),
            s.difficulty(),
            s.category(),
            List.copyOf(s.tags()),
            s
                .options()
                .stream()
                .map(o -> new SnapshotOption(UUID.randomUUID(), o.content(), o.correct()))
                .toList(),
            s.correctBoolean(),
            s.correctValue(),
            s.tolerance()
        );
    }

    private List<ExamVersionQuestion> ordered(ExamVersion v) {
        return v
            .getQuestions()
            .stream()
            .sorted(Comparator.comparingInt(ExamVersionQuestion::getPosition))
            .toList();
    }

    private String total(ExamVersion v) {
        return decimal(
            v
                .getQuestions()
                .stream()
                .map(ExamVersionQuestion::getPoints)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
        );
    }

    private String decimal(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private VersionSummary summary(ExamVersion v) {
        return new VersionSummary(
            v.getId(),
            v.getVersionNumber(),
            v.getStatus(),
            v.getRevision(),
            v.getQuestions().size(),
            total(v),
            v.getCreatedAt(),
            v.getUpdatedAt(),
            v.getPublishedAt()
        );
    }

    private ExamDetail view(Exam e) {
        return new ExamDetail(
            e.getId(),
            e.getName(),
            e.getDescription(),
            e.getStatus(),
            e.getRevision(),
            versions
                .findByExamIdOrderByVersionNumberDesc(e.getId())
                .stream()
                .map(this::summary)
                .toList(),
            e.getCreatedAt(),
            e.getUpdatedAt()
        );
    }

    private VersionDetail view(Exam e, ExamVersion v) {
        return new VersionDetail(
            v.getId(),
            e.getId(),
            e.getName(),
            e.getStatus(),
            v.getVersionNumber(),
            v.getStatus(),
            v.getRevision(),
            ordered(v)
                .stream()
                .map(q ->
                    new QuestionView(
                        q.getId(),
                        q.getSourceQuestionId(),
                        q.getSourceRevision(),
                        q.getPosition(),
                        decimal(q.getPoints()),
                        q.getSnapshot()
                    )
                )
                .toList(),
            total(v),
            v.getCreatedAt(),
            v.getUpdatedAt(),
            v.getPublishedAt()
        );
    }

    private void record(
        UUID actor,
        AuditAction action,
        String type,
        UUID id,
        Map<String, String> metadata
    ) {
        audit.record(actor.toString(), action, type, id.toString(), metadata);
    }
}
