export const workspaces = ["PARTICIPANT", "CREATOR", "ADMIN"] as const;
export type Workspace = (typeof workspaces)[number];
export const workspaceInfo: Record<
  Workspace,
  { label: string; href: string; description: string }
> = {
  PARTICIPANT: {
    label: "Người tham gia",
    href: "/participant",
    description: "Theo dõi kỳ thi, bài làm và kết quả của bạn.",
  },
  CREATOR: {
    label: "Người tạo",
    href: "/creator",
    description: "Soạn câu hỏi, xây dựng đề và tổ chức kỳ thi.",
  },
  ADMIN: {
    label: "Quản trị viên",
    href: "/admin",
    description: "Quản lý người dùng và theo dõi hoạt động hệ thống.",
  },
};
export function isWorkspace(value: string): value is Workspace {
  return workspaces.some((workspace) => workspace === value);
}
export function availableWorkspaces(roles: readonly string[]) {
  return workspaces.filter((workspace) => roles.includes(workspace));
}
export function canEnterWorkspace(
  workspace: Workspace,
  roles: readonly string[],
) {
  return roles.includes(workspace);
}
export type NavigationItem = {
  label: string;
  href?: string;
  icon:
    | "dashboard"
    | "exam"
    | "results"
    | "classes"
    | "questions"
    | "sessions"
    | "monitor"
    | "reports"
    | "users"
    | "audit"
    | "notifications"
    | "profile";
  available: boolean;
};
export function navigationFor(workspace: Workspace): NavigationItem[] {
  const base = workspaceInfo[workspace].href;
  const items: NavigationItem[] = [
    { label: "Tổng quan", href: base, icon: "dashboard", available: true },
  ];
  const pending = (
    label: string,
    href: string | undefined,
    icon: NavigationItem["icon"],
  ) => items.push({ label, href, icon, available: false });
  if (workspace === "PARTICIPANT") {
    pending("Kỳ thi của tôi", `${base}/exams`, "exam");
    pending("Kết quả", `${base}/results`, "results");
    pending("Lớp học của tôi", `${base}/classes`, "classes");
  } else if (workspace === "CREATOR") {
    pending("Ngân hàng câu hỏi", `${base}/questions`, "questions");
    pending("Đề thi", `${base}/exams`, "exam");
    pending("Kỳ thi", `${base}/sessions`, "sessions");
    pending("Lớp học", `${base}/classes`, "classes");
    pending("Giám sát", undefined, "monitor");
    pending("Báo cáo", undefined, "reports");
  } else {
    pending("Người dùng", `${base}/users`, "users");
    pending("Nhật ký hoạt động", `${base}/audit-logs`, "audit");
  }
  if (workspace !== "ADMIN")
    pending("Thông báo", "/notifications", "notifications");
  pending("Hồ sơ", "/profile", "profile");
  return items;
}
export function isActiveNavigation(
  pathname: string,
  href: string,
  workspace: Workspace,
) {
  return href === workspaceInfo[workspace].href
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
