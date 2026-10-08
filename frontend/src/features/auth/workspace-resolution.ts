import {
  availableWorkspaces,
  isWorkspace,
  workspaceInfo,
  type Workspace,
} from "@/features/workspace/navigation";
import type { CurrentUser } from "./session";

export function safeReturnTo(value: string | null, roles: readonly string[]): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value) ||
    /%2f|%5c|%2e/i.test(value)
  )
    return null;
  const path = value.split(/[?#]/)[0];
  if (path.split("/").some((segment) => segment === "." || segment === "..")) return null;
  if (path === "/profile" || path === "/notifications" || path === "/workspaces") return value;
  return availableWorkspaces(roles).some(
    (role) => path === workspaceInfo[role].href || path.startsWith(`${workspaceInfo[role].href}/`),
  )
    ? value
    : null;
}

export function rememberWorkspace(userId: string, workspace: Workspace) {
  try {
    localStorage.setItem(`learnova.workspace.${userId}`, workspace);
  } catch {
    /* Preference không được chặn navigation. */
  }
}

export function resolveWorkspace(user: CurrentUser, returnTo: string | null = null) {
  const target = safeReturnTo(returnTo, user.roles);
  if (target) return target;
  const roles = availableWorkspaces(user.roles);
  if (roles.length === 1) return workspaceInfo[roles[0]].href;
  try {
    const last = localStorage.getItem(`learnova.workspace.${user.id}`);
    if (last && isWorkspace(last) && roles.includes(last)) return workspaceInfo[last].href;
  } catch {
    /* Không bắt buộc browser storage để đăng nhập. */
  }
  return "/workspaces";
}
