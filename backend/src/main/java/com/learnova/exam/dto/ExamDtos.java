package com.learnova.exam.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.learnova.exam.enums.*;
import com.learnova.question.enums.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ExamDtos {
    private ExamDtos() {}
    public interface StrictInput {
        @JsonAnySetter default void unknown(String name, Object value) { throw new IllegalArgumentException("Unknown exam field"); }
    }
    public record CreateExam(@NotBlank @Size(max = 200) String name, @Size(max = 5000) String description) implements StrictInput {}
    public record NewVersion(UUID baseVersionId) implements StrictInput {}
    public record Revision(@NotNull @PositiveOrZero Long revision) implements StrictInput {}
    public record Source(@NotNull UUID questionId, @NotNull @PositiveOrZero Long revision) implements StrictInput {}
    public record AddQuestions(@NotNull @PositiveOrZero Long revision,
            @NotEmpty List<@NotNull @Valid Source> questions) implements StrictInput {}
    public record QuestionEdit(@NotNull UUID id, @NotNull String points) implements StrictInput {}
    public record SaveQuestions(@NotNull @PositiveOrZero Long revision,
            @NotNull List<@NotNull @Valid QuestionEdit> questions) implements StrictInput {}
    public record SnapshotOption(UUID id, String content, boolean correct) {}
    public record Snapshot(QuestionType type, String content, String explanation, Difficulty difficulty,
            String category, List<String> tags, List<SnapshotOption> options,
            Boolean correctBoolean, String correctValue, String tolerance) {}
    public record QuestionView(UUID id, UUID sourceQuestionId, long sourceRevision, int position, String points, Snapshot snapshot) {}
    public record VersionSummary(UUID id, int versionNumber, VersionStatus status, long revision, int questionCount,
            String totalScore, Instant createdAt, Instant updatedAt, Instant publishedAt) {}
    public record VersionDetail(UUID id, UUID examId, String examName, ExamStatus examStatus, int versionNumber,
            VersionStatus status, long revision, List<QuestionView> questions, String totalScore,
            Instant createdAt, Instant updatedAt, Instant publishedAt) {}
    public record ExamSummary(UUID id, String name, ExamStatus status, long revision, VersionSummary latestVersion, Instant updatedAt) {}
    public record ExamDetail(UUID id, String name, String description, ExamStatus status, long revision,
            List<VersionSummary> versions, Instant createdAt, Instant updatedAt) {}
}
