export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "NUMERIC_ANSWER";
export type QuestionStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type Option = { content: string; correct: boolean };
export type QuestionSummary = {
  id: string; type: QuestionType; status: QuestionStatus; contentPreview: string;
  difficulty: Difficulty | null; category: string | null; tags: string[]; revision: number; updatedAt: string;
};
export type QuestionDetail = Omit<QuestionSummary, "contentPreview"> & {
  content: string; explanation: string | null; options: Option[]; correctBoolean: boolean | null;
  correctValue: string | null; tolerance: string; createdAt: string;
};
export type QuestionWrite = Omit<QuestionDetail, "id" | "createdAt" | "updatedAt" | "revision"> & { revision?: number };
export type QuestionPage = { content: QuestionSummary[]; page: number; size: number; totalElements: number; totalPages: number };
export const typeLabels: Record<QuestionType, string> = { SINGLE_CHOICE: "Một đáp án", MULTIPLE_CHOICE: "Nhiều đáp án", TRUE_FALSE: "Đúng / Sai", NUMERIC_ANSWER: "Đáp án số" };
export const statusLabels: Record<QuestionStatus, string> = { DRAFT: "Bản nháp", ACTIVE: "Đang sử dụng", ARCHIVED: "Đã lưu trữ" };
export const difficultyLabels: Record<Difficulty, string> = { EASY: "Dễ", MEDIUM: "Trung bình", HARD: "Khó" };
