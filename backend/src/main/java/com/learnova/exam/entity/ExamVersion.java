package com.learnova.exam.entity;

import com.learnova.exam.enums.VersionStatus;
import com.learnova.exam.exception.ExamFailure;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
import lombok.Getter;

@Entity @Table(name = "exam_versions") @Getter
public class ExamVersion {
    @Id private UUID id;
    @Column(nullable = false) private UUID examId;
    @Column(nullable = false) private int versionNumber;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private VersionStatus status;
    @Column(nullable = false) private long revision;
    @Column(nullable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    private Instant publishedAt;
    @OneToMany(mappedBy = "version", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC") private List<ExamVersionQuestion> questions = new ArrayList<>();
    protected ExamVersion() {}
    public ExamVersion(UUID examId, int number, Instant now) {
        id = UUID.randomUUID(); this.examId = examId; versionNumber = number;
        status = VersionStatus.DRAFT; createdAt = now; updatedAt = now;
    }
    public List<ExamVersionQuestion> getQuestions() { return Collections.unmodifiableList(questions); }
    public void requireDraft() {
        if (status != VersionStatus.DRAFT) throw new ExamFailure(409, "EXAM_VERSION_IMMUTABLE");
    }
    public void add(ExamVersionQuestion question) { requireDraft(); questions.add(question); }
    public void retain(Set<UUID> ids) { requireDraft(); questions.removeIf(q -> !ids.contains(q.getId())); }
    public void touch(Instant now) { requireDraft(); revision++; updatedAt = now; }
    public void publish(Instant now) { touch(now); status = VersionStatus.PUBLISHED; publishedAt = now; }
}
