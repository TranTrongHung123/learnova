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
    items.push({ label: "Kỳ thi của tôi", href: `${base}/exams`, icon: "exam", available: true });
    pending("Kết quả", `${base}/results`, "results");
    items.push({ label: "Lớp học của tôi", href: `${base}/classes`, icon: "classes", available: true });
  } else if (workspace === "CREATOR") {
    items.push({ label: "Ngân hàng câu hỏi", href: `${base}/questions`, icon: "questions", available: true });
    items.push({ label: "Đề thi", href: `${base}/exams`, icon: "exam", available: true });
    items.push({ label: "Kỳ thi", href: `${base}/sessions`, icon: "sessions", available: true });
    items.push({ label: "Lớp học", href: `${base}/classes`, icon: "classes", available: true });
    pending("Giám sát", undefined, "monitor");
    pending("Báo cáo", undefined, "reports");
  } else {
    pending("Người dùng", `${base}/users`, "users");
    pending("Nhật ký hoạt động", `${base}/audit-logs`, "audit");
  }
  if (workspace !== "ADMIN")
    pending("Thông báo", "/notifications", "notifications");
  items.push({ label: "Hồ sơ", href: "/profile", icon: "profile", available: true });
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
