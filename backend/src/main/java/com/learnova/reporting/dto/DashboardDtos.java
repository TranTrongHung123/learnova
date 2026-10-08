package com.learnova.reporting.dto;

import com.learnova.notification.dto.NotificationDtos;
import com.learnova.session.dto.DiscoveryDtos;
import com.learnova.shared.api.PageResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DashboardDtos {

    private DashboardDtos() {}

    public record Attempt(UUID id, UUID sessionId, String title, Instant deadline) {}

    public record Result(
        UUID attemptId,
        UUID sessionId,
        String title,
        Instant completedAt,
        String rawScore,
        String totalScore,
        boolean passed
    ) {}

    public record Scores(long visibleSessionCount, String averagePercentage) {}

    public record Participant(
        Instant serverTime,
        PageResponse<DiscoveryDtos.Session> available,
        PageResponse<DiscoveryDtos.Session> upcoming,
        PageResponse<DiscoveryDtos.Session> completed,
        List<Attempt> inProgress,
        Scores scores,
        List<Result> recentResults,
        long unreadCount,
        List<NotificationDtos.Item> notifications
    ) {}

    public record Counts(
        long questions,
        long exams,
        long activeSessions,
        long upcomingSessions,
        long participants
    ) {}

    public record QuestionCounts(long draft, long active, long archived) {}

    public record Session(UUID id, String title, Instant startTime, Instant endTime) {}

    public record Exam(UUID id, String name, String status) {}

    public record Creator(
        Instant serverTime,
        Counts counts,
        QuestionCounts questionCounts,
        List<Session> activeSessions,
        List<Session> upcomingSessions,
        List<Exam> recentExams,
        List<Result> recentResults
    ) {}

    public record Admin(
        Instant serverTime,
        long users,
        long activeUsers,
        long participants,
        long creators,
        long admins,
        long exams,
        long sessions,
        long activeSessions,
        long upcomingSessions
    ) {}
}
