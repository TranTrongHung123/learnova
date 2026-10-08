package com.learnova.attempt.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.*;

public final class ResultDtos {

    private ResultDtos() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Score(String score, String totalScore, boolean passed) {}

    public record Summary(
        int correctCount,
        int incorrectCount,
        int unansweredCount,
        long durationSeconds
    ) {}

    public record Option(UUID id, String content, boolean correct) {}

    public record Question(
        UUID id,
        String type,
        String content,
        List<Option> options,
        AttemptDtos.Answer answer,
        Boolean correctBoolean,
        String correctValue,
        String tolerance,
        String explanation,
        boolean correct,
        String points,
        String awardedScore
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Detail(
        UUID id,
        UUID sessionId,
        String title,
        int attemptNumber,
        String status,
        Instant submittedAt,
        String displayMode,
        String availability,
        Score result,
        Summary summary,
        List<Question> questions
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record History(
        UUID sessionId,
        String title,
        String examName,
        UUID participantId,
        String participantName,
        long attemptCount,
        Instant completedAt,
        UUID bestAttemptId,
        String availability,
        Score bestResult
    ) {}

    public record SessionResults(
        String title,
        String displayMode,
        String releasePolicy,
        Instant releasedAt,
        boolean canRelease,
        com.learnova.shared.api.PageResponse<History> participants
    ) {}
}
