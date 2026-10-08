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

export function canEnterWorkspace(workspace: Workspace, roles: readonly string[]) {
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
  if (workspace === "PARTICIPANT") {
    items.push({ label: "Kỳ thi của tôi", href: `${base}/exams`, icon: "exam", available: true });
    items.push({ label: "Kết quả", href: `${base}/results`, icon: "results", available: true });
    items.push({
      label: "Lớp học của tôi",
      href: `${base}/classes`,
      icon: "classes",
      available: true,
    });
  } else if (workspace === "CREATOR") {
    items.push({
      label: "Ngân hàng câu hỏi",
      href: `${base}/questions`,
      icon: "questions",
      available: true,
    });
    items.push({ label: "Đề thi", href: `${base}/exams`, icon: "exam", available: true });
    items.push({ label: "Kỳ thi", href: `${base}/sessions`, icon: "sessions", available: true });
    items.push({ label: "Lớp học", href: `${base}/classes`, icon: "classes", available: true });
    items.push({ label: "Giám sát", href: `${base}/monitor`, icon: "monitor", available: true });
    items.push({ label: "Báo cáo", href: `${base}/reports`, icon: "reports", available: true });
  } else {
    items.push({ label: "Người dùng", href: `${base}/users`, icon: "users", available: true });
    items.push({
      label: "Nhật ký hoạt động",
      href: `${base}/audit-logs`,
      icon: "audit",
      available: true,
    });
  }
  if (workspace !== "ADMIN")
    items.push({
      label: "Thông báo",
      href: "/notifications",
      icon: "notifications",
      available: true,
    });
  items.push({ label: "Hồ sơ", href: "/profile", icon: "profile", available: true });
  return items;
}

export function isActiveNavigation(pathname: string, href: string, workspace: Workspace) {
  return href === workspaceInfo[workspace].href
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
