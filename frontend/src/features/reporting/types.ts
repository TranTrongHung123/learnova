import type { Snapshot } from "@/features/exam/types";

export type Analytics = {
  sessionId: string; examVersionId: string; title: string; totalScore: string; accessType: "PUBLIC" | "CLASS" | "INDIVIDUAL";
  generatedAt: string; scoreSample: "BEST_SCORE_PER_PARTICIPANT"; questionSample: "ALL_GRADED_ATTEMPTS";
  overview: { participantCount: number; gradedParticipantCount: number; completedParticipantCount: number;
    averageScore: number | null; highestScore: number | null; lowestScore: number | null; passRate: number | null; completionRate: number | null };
  distribution: { lowerPercent: number; upperPercent: number; upperInclusive: boolean; count: number }[];
  questions: { id: string; position: number; points: string; snapshot: Snapshot; sampleCount: number;
    correctCount: number; incorrectCount: number; unansweredCount: number;
    correctRate: number | null; incorrectRate: number | null; unansweredRate: number | null; timedSampleCount: number; averageAnswerTimeMs: number | null }[];
};
export function metric(value: number | null | undefined, suffix = "") {
  return value == null ? "Không có dữ liệu" : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}
