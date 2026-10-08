import type { QuestionDetail } from "@/features/question/types";

export type Snapshot = Pick<
  QuestionDetail,
  | "type"
  | "content"
  | "explanation"
  | "difficulty"
  | "category"
  | "tags"
  | "correctBoolean"
  | "correctValue"
  | "tolerance"
> & {
  options: { id: string; content: string; correct: boolean }[];
};

export type ExamQuestion = {
  id: string;
  sourceQuestionId: string;
  sourceRevision: number;
  position: number;
  points: string;
  snapshot: Snapshot;
};

export type VersionSummary = {
  id: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED";
  revision: number;
  questionCount: number;
  totalScore: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type VersionDetail = Omit<VersionSummary, "questionCount"> & {
  examId: string;
  examName: string;
  examStatus: "ACTIVE" | "ARCHIVED";
  questions: ExamQuestion[];
};

export type ExamSummary = {
  id: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
  revision: number;
  latestVersion: VersionSummary;
  updatedAt: string;
};

export type ExamDetail = Omit<ExamSummary, "latestVersion"> & {
  description: string | null;
  versions: VersionSummary[];
  createdAt: string;
};

export type ExamPage = {
  content: ExamSummary[];
  page: number;
  totalElements: number;
  totalPages: number;
};

export const versionLabel = { DRAFT: "Bản nháp", PUBLISHED: "Đã xuất bản" };

export const examLabel = { ACTIVE: "Đang sử dụng", ARCHIVED: "Đã lưu trữ" };

export const versionPath = (examId: string, id: string, edit = false) =>
  `/creator/exams/${examId}/versions/${id}${edit ? "/edit" : ""}`;
