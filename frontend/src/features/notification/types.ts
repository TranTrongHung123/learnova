export type NotificationType =
  "EXAM_ASSIGNED" | "EXAM_REMINDER" | "RESULT_RELEASED" | "CLASS_JOINED";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  targetPath: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationPage = {
  content: Notification[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type UnreadCount = { unreadCount: number };

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function notificationTarget(item: Pick<Notification, "type" | "targetPath">): string | null {
  const patterns: Record<NotificationType, RegExp> = {
    EXAM_ASSIGNED: new RegExp(`^/participant/exams/${uuid}$`, "i"),
    EXAM_REMINDER: new RegExp(`^/participant/exams/${uuid}$`, "i"),
    RESULT_RELEASED: new RegExp(`^/participant/results/${uuid}$`, "i"),
    CLASS_JOINED: new RegExp(`^(/participant/classes|/creator/classes/${uuid})$`, "i"),
  };
  return patterns[item.type]?.test(item.targetPath) ? item.targetPath : null;
}
