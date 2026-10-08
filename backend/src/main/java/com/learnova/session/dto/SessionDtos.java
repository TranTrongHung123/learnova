package com.learnova.session.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.learnova.session.enums.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class SessionDtos {

    private SessionDtos() {}

    public interface StrictInput {
        @JsonAnySetter
        default void unknown(String name, Object value) {
            throw new IllegalArgumentException("Unknown session field");
        }
    }

    public record WriteSession(
        @PositiveOrZero Long revision,
        @NotBlank @Size(max = 200) String title,
        @NotNull UUID examVersionId,
        @NotNull Instant startTime,
        @NotNull Instant endTime,
        @NotNull
        @Positive
        @tools.jackson.databind.annotation.JsonDeserialize(using = PositiveIntegerReader.class)
        Integer durationMinutes,
        @NotNull
        @Positive
        @tools.jackson.databind.annotation.JsonDeserialize(using = PositiveIntegerReader.class)
        Integer maxAttempts,
        @NotNull @Size(max = 42) String passingScore,
        @NotNull AccessType accessType,
        @NotNull @Size(max = 500) List<@NotNull UUID> classroomIds,
        @NotNull @Size(max = 500) List<@NotNull UUID> participantIds,
        @NotNull Boolean shuffleQuestions,
        @NotNull Boolean shuffleAnswers,
        ResultDisplayMode resultDisplayMode,
        ResultReleasePolicy resultReleasePolicy
    ) implements StrictInput {
        public WriteSession {
            if (resultDisplayMode == null) resultDisplayMode = ResultDisplayMode.SUMMARY;
            if (resultReleasePolicy == null) resultReleasePolicy =
                ResultReleasePolicy.AFTER_SESSION_END;
        }
    }

    public static final class PositiveIntegerReader
        extends tools.jackson.databind.ValueDeserializer<Integer>
    {

        @Override
        public Integer deserialize(
            tools.jackson.core.JsonParser p,
            tools.jackson.databind.DeserializationContext c
        ) {
            if (
                !p.hasToken(tools.jackson.core.JsonToken.VALUE_NUMBER_INT)
            ) return c.reportInputMismatch(Integer.class, "Expected integer");
            return p.getIntValue();
        }
    }

    public record Revision(@NotNull @PositiveOrZero Long revision) implements StrictInput {}

    public record Extend(
        @NotNull @PositiveOrZero Long revision,
        @NotNull Instant newEndTime
    ) implements StrictInput {}

    public record Target(UUID id, String name) {}

    public record Actions(
        boolean editConfiguration,
        boolean editTitle,
        boolean schedule,
        boolean cancel,
        boolean extend
    ) {}

    public record Detail(
        UUID id,
        String title,
        UUID examId,
        UUID examVersionId,
        String examName,
        int versionNumber,
        int questionCount,
        String totalScore,
        SessionStatus status,
        Instant startTime,
        Instant endTime,
        int durationMinutes,
        int maxAttempts,
        String passingScore,
        AccessType accessType,
        List<Target> classrooms,
        List<Target> participants,
        Long assignedParticipantCount,
        boolean shuffleQuestions,
        boolean shuffleAnswers,
        ResultDisplayMode resultDisplayMode,
        ResultReleasePolicy resultReleasePolicy,
        boolean hasAttempts,
        long revision,
        Instant serverTime,
        Instant createdAt,
        Instant updatedAt,
        Actions actions
    ) {}
}
