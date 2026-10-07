import type { PageResult } from "@/features/classroom/types";
import type { Workspace } from "@/features/workspace/navigation";

export const statusLabels = { ACTIVE: "Đang hoạt động", LOCKED: "Đã khóa", DISABLED: "Ngừng hoạt động" } as const;
export const businessRoles = ["PARTICIPANT", "CREATOR"] as const;
export type BusinessRole = (typeof businessRoles)[number];
export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  status: keyof typeof statusLabels;
  roles: Workspace[];
  createdAt: string;
  onboardingCompleted: boolean;
};
export type UserPage = PageResult<AdminUser>;
export type AuditItem = {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, string>;
  occurredAt: string;
};
export type AuditPage = PageResult<AuditItem>;
export const auditActions = [
  "ADMIN_BOOTSTRAPPED", "ROLE_CHANGED", "ACCOUNT_LOCKED", "ACCOUNT_UNLOCKED", "PASSWORD_CHANGED",
  "GOOGLE_ACCOUNT_LINKED", "ONBOARDING_COMPLETED", "CLASSROOM_CREATED", "CLASSROOM_UPDATED",
  "CLASSROOM_MEMBER_ADDED", "CLASSROOM_MEMBER_REMOVED", "CLASSROOM_JOINED", "CLASSROOM_LEFT",
  "CLASSROOM_JOIN_CODE_GENERATED", "CLASSROOM_JOIN_CODE_REVOKED", "QUESTIONS_IMPORTED", "QUESTION_CREATED",
  "QUESTION_UPDATED", "QUESTION_ARCHIVED", "QUESTION_RESTORED", "EXAM_CREATED", "EXAM_VERSION_CREATED",
  "EXAM_VERSION_PUBLISHED", "EXAM_ARCHIVED", "SESSION_CREATED", "SESSION_SCHEDULED", "SESSION_UPDATED",
  "SESSION_CANCELLED", "SESSION_END_TIME_EXTENDED", "RESULT_MANUALLY_RELEASED",
] as const;
