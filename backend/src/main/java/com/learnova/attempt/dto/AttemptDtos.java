package com.learnova.attempt.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class AttemptDtos {
    private AttemptDtos() {}
    public interface StrictInput {
        @JsonAnySetter default void unknown(String key, Object value) { throw new IllegalArgumentException("Unknown field"); }
    }
    public record Answer(@NotNull @Size(max=20) List<@NotNull UUID> optionIds,
                         Boolean booleanValue, @Size(max=42) String numericValue) implements StrictInput {
        public static Answer empty() { return new Answer(List.of(), null, null); }
    }
    public record Save(@NotNull @PositiveOrZero @tools.jackson.databind.annotation.JsonDeserialize(using=WholeNumber.class) Long revision,
                       @NotNull @Valid Answer answer, @NotNull Boolean markedForReview,
                       @PositiveOrZero @tools.jackson.databind.annotation.JsonDeserialize(using=WholeNumber.class) Long activeTimeMs) implements StrictInput {}
    public static final class WholeNumber extends tools.jackson.databind.ValueDeserializer<Long> {
        @Override public Long deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context) {
            if (!parser.hasToken(tools.jackson.core.JsonToken.VALUE_NUMBER_INT)) return context.reportInputMismatch(Long.class,"Expected an integer");
            return parser.getLongValue();
        }
    }
    public record Option(UUID id, String content) {}
    public record State(UUID questionId, Answer answer, boolean markedForReview, long revision,
                        Long activeTimeMs, Instant savedAt) {}
    public record Question(UUID id, String type, String content, List<Option> options, State state) {}
    public record View(UUID id, UUID sessionId, UUID examVersionId, String title, int attemptNumber,
                       String status, Instant startedAt, Instant deadline, Instant serverTime,
                       boolean canEdit, List<Question> questions, String completionReason, Instant submittedAt, Instant gradedAt) {}
    public record Started(boolean created, View attempt) {}
    public record Saved(State state, Instant serverTime) {}
}
