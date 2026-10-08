"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { PageState, Skeleton } from "@/components/ui/page-state";
import { Modal } from "@/features/classroom/shared";
import { statusLabels, type AdminUser } from "./types";

export { panel, control, date, Pagination } from "@/features/classroom/shared";

export const usersApi = "/api/v1/admin/users";

export function adminMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.problem?.code) {
      case "SELF_LOCK_FORBIDDEN":
        return "Bạn không thể tự khóa tài khoản đang quản trị.";
      case "USER_STATE_CONFLICT":
        return "Tài khoản đang ngừng hoạt động. Không thể khóa hoặc mở khóa ở trạng thái này.";
      case "USER_ONBOARDING_PENDING":
        return "Người dùng cần hoàn tất thiết lập tài khoản trước khi sửa vai trò.";
      case "ACCOUNT_LOCKED":
        return "Tài khoản của bạn đã bị khóa.";
    }
    return error.message;
  }
  return "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
}

export function QueryState({ error, retry }: { error?: unknown; retry: () => void }) {
  if (!error) return <Skeleton />;
  const kind =
    error instanceof ApiError && error.status === 403
      ? "forbidden"
      : error instanceof ApiError && error.status === 404
        ? "not-found"
        : "network";
  return (
    <PageState
      kind={kind}
      description={adminMessage(error)}
      action={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

export function UserStatus({ user }: { user: AdminUser }) {
  return (
    <span
      className={`inline-flex rounded-lg bg-background px-3 py-1 text-sm font-semibold ${user.status === "ACTIVE" ? "text-success" : user.status === "LOCKED" ? "text-danger" : "text-muted-foreground"}`}
    >
      {statusLabels[user.status]}
    </span>
  );
}

export function ConfirmMutation({
  title,
  children,
  confirmLabel,
  action,
  onClose,
  onDone,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  action: () => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      onDone();
      onClose();
    } catch (cause) {
      setError(adminMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} busy={busy} onClose={onClose}>
      <div className="space-y-4">
        {children}
        {error && (
          <p role="alert" className="text-danger">
            {error} Nếu mất kết nối, hãy đóng hộp thoại và làm mới để kiểm tra trạng thái trước khi
            thử lại.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? "Đang xử lý…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function StatusAction({ target, onDone }: { target: AdminUser; onDone: () => void }) {
  const { user, session } = useAuth();
  const [open, setOpen] = useState(false);
  if (target.status === "DISABLED") return null;
  const locking = target.status === "ACTIVE";
  const self = target.id === user?.id;
  const label = locking ? "Khóa tài khoản" : "Mở khóa tài khoản";
  return (
    <>
      <Button variant="secondary" disabled={locking && self} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {locking && self && (
        <p className="text-sm text-muted-foreground">Không thể tự khóa tài khoản.</p>
      )}
      {open && (
        <ConfirmMutation
          title={label}
          confirmLabel={locking ? "Xác nhận khóa" : "Xác nhận mở khóa"}
          onClose={() => setOpen(false)}
          onDone={onDone}
          action={() =>
            session.api.request(`${usersApi}/${target.id}/${locking ? "lock" : "unlock"}`, {
              method: "POST",
            })
          }
        >
          <p className="font-semibold [overflow-wrap:anywhere]">
            {target.displayName} · {target.email}
          </p>
          <p>
            {locking
              ? "Các phiên refresh hiện tại sẽ bị thu hồi; người dùng không thể đăng nhập hoặc refresh. Access token cũ có thể còn hiệu lực tối đa 15 phút, nhưng không được bắt đầu bài làm mới."
              : "Tài khoản sẽ hoạt động trở lại. Người dùng phải đăng nhập lại; các phiên cũ không được khôi phục."}
          </p>
          <p>
            Lịch sử bài làm, kết quả và dữ liệu đã tạo được giữ nguyên. Thao tác được ghi vào nhật
            ký.
          </p>
        </ConfirmMutation>
      )}
    </>
  );
}
