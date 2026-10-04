package com.learnova.session.dto;

import java.time.Instant;
import java.util.UUID;

public final class DiscoveryDtos {
    private DiscoveryDtos() {}
    public enum Tab { AVAILABLE, UPCOMING, COMPLETED, EXPIRED }
    public record Session(UUID id, String title, String description, String creatorName,
            Instant startTime, Instant endTime, int durationMinutes, int questionCount,
            String totalScore, String passingScore, int maxAttempts, long attemptsUsed,
            String accessType, String status, String resultDisplayMode, String resultReleasePolicy,
            Instant serverTime, boolean canStart, boolean canContinue, UUID activeAttemptId,
            String unavailableReason) {}
    public record Attempt(UUID id, int attemptNumber, String status, Instant startedAt,
            Instant deadline, Instant submittedAt) {}
}
