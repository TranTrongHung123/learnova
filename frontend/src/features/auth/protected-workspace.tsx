"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { PageState, Skeleton } from "@/components/ui/page-state";
import { NotificationBell } from "@/features/notification/notifications";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";
import {
  availableWorkspaces,
  workspaceInfo,
  type Workspace,
} from "@/features/workspace/navigation";
import { useAuth } from "./auth-provider";
import { authMessage } from "./session";
import { rememberWorkspace, resolveWorkspace } from "./workspace-resolution";

export function ProtectedWorkspace({
  workspace,
  title,
  selection = false,
  focused = false,
  children,
}: {
  workspace?: Workspace;
  title: string;
  selection?: boolean;
  focused?: boolean;
  children?: React.ReactNode | ((actions: { logoutAll: () => void }) => React.ReactNode);
}) {
  const { status, user, error, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const confirmation = useRef<HTMLDialogElement>(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryAll, setRetryAll] = useState(false);
  useEffect(() => {
    if (confirmingLogout) confirmation.current?.showModal();
    else confirmation.current?.close();
  }, [confirmingLogout]);
  useEffect(() => {
    if (status === "UNAUTHENTICATED" && !busy && !logoutError)
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    if (user && workspace && user.roles.includes(workspace)) rememberWorkspace(user.id, workspace);
  }, [status, user, workspace, pathname, router, busy, logoutError]);

  async function logout(all = false) {
    confirmation.current?.close();
    setBusy(true);
    setLogoutError("");
    setRetryAll(all);
    try {
      await session.logout(all);
      router.replace("/login");
    } catch (cause) {
      setLogoutError(
        `Đã dừng sử dụng phiên trên trang này, nhưng chưa xác nhận thu hồi phiên phía máy chủ. ${authMessage(cause)}`,
      );
    } finally {
      setBusy(false);
    }
  }
  if (logoutError)
    return (
      <main id="main-content" className="mx-auto max-w-2xl p-6">
        <PageState
          kind="network"
          description={logoutError}
          action={
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void logout(retryAll)}>Thử đăng xuất lại</Button>
              <LinkButton variant="secondary" href="/login">
                Đến đăng nhập
              </LinkButton>
            </div>
          }
        />
      </main>
    );
  if (status === "ERROR")
    return (
      <main id="main-content" className="p-6">
        <PageState
          kind="network"
          description={error}
          action={<Button onClick={() => void session.bootstrap()}>Thử lại</Button>}
        />
      </main>
    );
  if (!user || status !== "AUTHENTICATED")
    return (
      <main id="main-content" className="p-6">
        <Skeleton />
      </main>
    );
  const allowed = availableWorkspaces(user.roles);
  const selected =
    workspace ??
    allowed.find((role) => workspaceInfo[role].href === resolveWorkspace(user)) ??
    allowed[0];
  if (!selected || (workspace && !allowed.includes(workspace)))
    return (
      <main id="main-content" className="p-6">
        <PageState
          kind="forbidden"
          action={<LinkButton href="/workspaces">Chọn không gian làm việc</LinkButton>}
        />
      </main>
    );
  if (focused)
    return (
      <main id="main-content" className="mx-auto min-h-dvh max-w-7xl p-4 sm:p-6" key={user.id}>
        {typeof children === "function"
          ? children({ logoutAll: () => setConfirmingLogout(true) })
          : children}
      </main>
    );
  return (
    <WorkspaceShell
      notificationBell={
        user.roles.some((role) => role === "PARTICIPANT" || role === "CREATOR") ? (
          <NotificationBell key={user.id} />
        ) : undefined
      }
      workspace={selected}
      roles={user.roles}
      user={{ displayName: user.displayName, subtitle: user.email, avatarUrl: user.avatarUrl }}
      pathname={pathname}
      onWorkspaceChange={(role) => {
        rememberWorkspace(user.id, role);
        router.push(workspaceInfo[role].href);
      }}
      onLogout={() => void logout()}
      onLogoutAll={() => setConfirmingLogout(true)}
    >
      <h1 className="text-3xl font-bold">{title}</h1>
      {children ? (
        <div key={user.id}>
          {typeof children === "function"
            ? children({ logoutAll: () => setConfirmingLogout(true) })
            : children}
        </div>
      ) : selection ? (
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Không gian làm việc">
          {allowed.map((role) => (
            <div className="rounded-xl border border-border bg-surface p-6" key={role}>
              <h2 className="text-xl font-bold">{workspaceInfo[role].label}</h2>
              <p className="my-4 text-muted-foreground">{workspaceInfo[role].description}</p>
              <Button
                onClick={() => {
                  rememberWorkspace(user.id, role);
                  router.push(workspaceInfo[role].href);
                }}
              >
                Vào không gian {workspaceInfo[role].label.toLowerCase()}
              </Button>
            </div>
          ))}
        </section>
      ) : (
        <PageState
          kind="unavailable"
          description="Tài khoản của bạn đã sẵn sàng. Các tính năng trong không gian này đang được hoàn thiện."
        />
      )}
      <dialog
        ref={confirmation}
        onClose={() => setConfirmingLogout(false)}
        aria-labelledby="logout-all-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface p-6 text-foreground backdrop:bg-scrim"
      >
        <h2 id="logout-all-title" className="text-xl font-bold">
          Đăng xuất tất cả thiết bị?
        </h2>
        <p className="my-4">
          Mọi phiên sẽ không thể gia hạn đăng nhập. Phiên truy cập đã cấp có thể còn hiệu lực tối đa
          15 phút.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => confirmation.current?.close()}>
            Hủy
          </Button>
          <Button disabled={busy} onClick={() => void logout(true)}>
            Đăng xuất tất cả
          </Button>
        </div>
      </dialog>
    </WorkspaceShell>
  );
}
