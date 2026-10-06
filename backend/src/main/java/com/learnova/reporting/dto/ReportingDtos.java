package com.learnova.reporting.dto;

import com.learnova.exam.dto.ExamDtos.Snapshot;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ReportingDtos {
    private ReportingDtos() {}
    public record Overview(long participantCount, long gradedParticipantCount, long completedParticipantCount,
            BigDecimal averageScore, BigDecimal highestScore, BigDecimal lowestScore,
            BigDecimal passRate, BigDecimal completionRate) {}
    public record Bucket(int lowerPercent, int upperPercent, boolean upperInclusive, long count) {}
    public record Question(UUID id, int position, String points, Snapshot snapshot, long sampleCount,
            long correctCount, long incorrectCount, long unansweredCount, BigDecimal correctRate,
            BigDecimal incorrectRate, BigDecimal unansweredRate, long timedSampleCount, BigDecimal averageAnswerTimeMs) {}
    public record Analytics(UUID sessionId, UUID examVersionId, String title, String totalScore, String accessType, Instant generatedAt,
            String scoreSample, String questionSample, Overview overview, List<Bucket> distribution, List<Question> questions) {}
}
