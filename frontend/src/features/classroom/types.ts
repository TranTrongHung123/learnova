export type PageResult<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type MembershipStatus = "ACTIVE" | "REMOVED";

export type CodeStatus = "NOT_CREATED" | "ACTIVE" | "EXPIRED" | "REVOKED";

export type JoinCode = { status: CodeStatus; code: string | null; expiresAt: string | null };

export type ClassroomSummary = {
  id: string;
  name: string;
  description: string | null;
  activeParticipants: number;
  joinCodeStatus: CodeStatus;
  updatedAt: string;
};

export type ClassroomDetail = Omit<ClassroomSummary, "joinCodeStatus"> & {
  joinCode: JoinCode;
  createdAt: string;
};

export type Participant = { userId: string; email: string; displayName: string };

export type Member = Participant & {
  id: string;
  status: MembershipStatus;
  joinedAt: string;
  updatedAt: string;
};

export type JoinedClassroom = {
  id: string;
  name: string;
  description: string | null;
  creatorName: string;
  joinedAt: string;
};

export type JoinPreview = Omit<JoinedClassroom, "joinedAt"> & {
  membershipStatus: MembershipStatus | null;
};

export const codeLabels: Record<CodeStatus, string> = {
  NOT_CREATED: "Chưa tạo mã",
  ACTIVE: "Mã còn hiệu lực",
  EXPIRED: "Mã đã hết hạn",
  REVOKED: "Mã đã thu hồi",
};
