package com.learnova.question.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.learnova.question.enums.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class QuestionDtos {

    private QuestionDtos() {}

    public record ExamCandidate(UUID id, long revision) {}

    public record Option(String content, boolean correct) {
        @JsonAnySetter
        public void unknown(String name, Object value) {
            throw new IllegalArgumentException("Unknown option field");
        }
    }

    public record WriteQuestion(
        QuestionType type,
        QuestionStatus status,
        String content,
        String explanation,
        Difficulty difficulty,
        String category,
        List<String> tags,
        List<Option> options,
        Boolean correctBoolean,
        String correctValue,
        String tolerance,
        Long revision
    ) {
        @JsonAnySetter
        public void unknown(String name, Object value) {
            throw new IllegalArgumentException("Unknown question field");
        }
    }

    public record Revision(@NotNull @PositiveOrZero Long revision) {
        @JsonAnySetter
        public void unknown(String name, Object value) {
            throw new IllegalArgumentException("Unknown command field");
        }
    }

    public record Summary(
        UUID id,
        QuestionType type,
        QuestionStatus status,
        String contentPreview,
        Difficulty difficulty,
        String category,
        List<String> tags,
        long revision,
        Instant updatedAt
    ) {}

    public record Detail(
        UUID id,
        QuestionType type,
        QuestionStatus status,
        String content,
        String explanation,
        Difficulty difficulty,
        String category,
        List<String> tags,
        List<Option> options,
        Boolean correctBoolean,
        String correctValue,
        String tolerance,
        long revision,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
