export const apiRoot = "/api/v1/participant/exam-sessions";

export const tabs = {
  AVAILABLE: "Có thể làm",
  UPCOMING: "Sắp diễn ra",
  COMPLETED: "Đã hoàn thành",
  EXPIRED: "Đã đóng",
} as const;

export type Tab = keyof typeof tabs;

export function filters(search: { get: (key: string) => string | null }) {
  const value = search.get("tab");
  const tab: Tab = value && Object.hasOwn(tabs, value) ? (value as Tab) : "AVAILABLE";
  const raw = search.get("page") ?? "0";
  const page = /^\d+$/.test(raw) && Number(raw) <= 2147483647 ? Number(raw) : 0;
  return { tab, page };
}

export type PageResult<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type DiscoveredSession = {
  id: string;
  title: string;
  description: string | null;
  creatorName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  questionCount: number;
  totalScore: string;
  passingScore: string;
  maxAttempts: number;
  attemptsUsed: number;
  accessType: "PUBLIC" | "CLASS" | "INDIVIDUAL";
  status: "SCHEDULED" | "OPEN" | "CLOSED";
  resultDisplayMode: "HIDDEN" | "SCORE_ONLY" | "SUMMARY" | "DETAILED";
  resultReleasePolicy: "IMMEDIATE" | "AFTER_SESSION_END" | "MANUAL";
  serverTime: string;
  canStart: boolean;
  canContinue: boolean;
  activeAttemptId: string | null;
  unavailableReason: string | null;
};

export type AttemptMetadata = {
  id: string;
  attemptNumber: number;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED" | "GRADED";
  startedAt: string;
  deadline: string;
  submittedAt: string | null;
};

export const reasons: Record<string, string> = {
  NOT_ASSIGNED: "Bạn không còn được giao kỳ thi này. Lịch sử bài làm vẫn được giữ nguyên.",
  NOT_STARTED: "Kỳ thi chưa đến giờ bắt đầu.",
  SESSION_CLOSED: "Kỳ thi đã đóng.",
  ATTEMPTS_EXHAUSTED: "Bạn đã dùng hết số lượt làm bài.",
  ATTEMPT_DEADLINE_PASSED: "Bài làm đã hết thời gian và đang chờ hệ thống xử lý.",
};
