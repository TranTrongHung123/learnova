package com.learnova.monitoring.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class MonitoringDtos {
    private MonitoringDtos() {}
    public record Participant(UUID participantId, String displayName, UUID attemptId, int attemptNumber,
            String status, int answeredCount, int totalQuestions, Instant lastSeen, String connectionStatus) {}
    public record Summary(int total, Integer notStarted, int inProgress, int submitted, int disconnected) {}
    public record Snapshot(UUID sessionId, String title, String sessionStatus, String accessType,
            Instant serverTime, Summary summary, List<Participant> participants) {}
    public record Change(String type, Participant participant) {}
    public record Frame(String type, UUID streamId, long sequence, UUID sessionId, String title,
            String sessionStatus, String accessType, Instant serverTime, Summary summary,
            List<Change> changes, List<UUID> removedParticipantIds) {}
}
