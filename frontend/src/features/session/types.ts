export type Status = "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "CANCELLED";

export type Access = "PUBLIC" | "CLASS" | "INDIVIDUAL";

export const statusLabels: Record<Status, string> = {
  DRAFT: "Bản nháp",
  SCHEDULED: "Đã lên lịch",
  OPEN: "Đang mở",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
};

export const accessLabels: Record<Access, string> = {
  PUBLIC: "Công khai",
  CLASS: "Theo lớp",
  INDIVIDUAL: "Cá nhân",
};

export const displayLabels = {
  HIDDEN: "Ẩn kết quả",
  SCORE_ONLY: "Chỉ điểm",
  SUMMARY: "Tóm tắt",
  DETAILED: "Chi tiết",
};

export const releaseLabels = {
  IMMEDIATE: "Ngay sau khi chấm",
  AFTER_SESSION_END: "Sau khi kỳ thi kết thúc",
  MANUAL: "Công bố thủ công",
};

export type Target = { id: string; name: string };

export type SessionDetail = {
  id: string;
  title: string;
  examId: string;
  examVersionId: string;
  examName: string;
  versionNumber: number;
  questionCount: number;
  totalScore: string;
  status: Status;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  maxAttempts: number;
  passingScore: string;
  accessType: Access;
  classrooms: Target[];
  participants: Target[];
  assignedParticipantCount: number | null;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  resultDisplayMode: keyof typeof displayLabels;
  resultReleasePolicy: keyof typeof releaseLabels;
  hasAttempts: boolean;
  revision: number;
  serverTime: string;
  createdAt: string;
  updatedAt: string;
  actions: {
    editConfiguration: boolean;
    editTitle: boolean;
    schedule: boolean;
    cancel: boolean;
    extend: boolean;
  };
};

export type PageResult<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export const apiRoot = "/api/v1/exam-sessions";

export const path = (id: string) => `/creator/sessions/${id}`;

export function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function payload(s: SessionDetail) {
  return {
    revision: s.revision,
    title: s.title,
    examVersionId: s.examVersionId,
    startTime: s.startTime,
    endTime: s.endTime,
    durationMinutes: s.durationMinutes,
    maxAttempts: s.maxAttempts,
    passingScore: s.passingScore,
    accessType: s.accessType,
    classroomIds: s.classrooms.map((c) => c.id),
    participantIds: s.participants.map((p) => p.id),
    shuffleQuestions: s.shuffleQuestions,
    shuffleAnswers: s.shuffleAnswers,
    resultDisplayMode: s.resultDisplayMode,
    resultReleasePolicy: s.resultReleasePolicy,
  };
}
