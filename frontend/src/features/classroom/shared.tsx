"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { PageState, Skeleton } from "@/components/ui/page-state";
import type { PageResult } from "./types";

export const panel = "rounded-xl border border-border bg-surface p-4 sm:p-6";
export const control = "min-h-11 w-full rounded-lg border border-control-border bg-surface px-3 py-2";
export const apiRoot = "/api/v1/classrooms";
export function date(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
export function classroomMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    switch (cause.problem?.code) {
      case "JOIN_CODE_INVALID": return "Mã không hợp lệ, đã hết hạn hoặc đã được thu hồi. Hãy xin mã mới từ người tạo lớp.";
      case "PARTICIPANT_NOT_FOUND": return "Không tìm thấy Participant có thể thêm với thông tin này. Hãy kiểm tra email hoặc chia sẻ mã sau khi người đó đăng ký.";
      case "MEMBERSHIP_NOT_FOUND": return "Thành viên không còn khả dụng. Hãy tải lại danh sách.";
      case "CLASSROOM_CONFLICT": return "Dữ liệu vừa thay đổi. Hãy tải lại và thử lại.";
    }
    return cause.message;
  }
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}
export function useClassroomQuery<T>(path: string) {
  const { session } = useAuth();
  const [revision, setRevision] = useState(0);
  const key = `${path}:${revision}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: unknown }>({ key: "" });
  useEffect(() => {
    const controller = new AbortController();
    session.api.request<T>(path, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ key, data }); },
      (error: unknown) => { if (!controller.signal.aborted) setResult({ key, error }); },
    );
    return () => controller.abort();
  }, [session, path, key]);
  return { data: result.key.startsWith(`${path}:`) ? result.data : undefined, error: result.key === key ? result.error : undefined, reload: () => setRevision((n) => n + 1) };
}
export function QueryState({ error, retry }: { error?: unknown; retry: () => void }) {
  if (!error) return <Skeleton />;
  const kind = error instanceof ApiError && error.status === 403 ? "forbidden" : error instanceof ApiError && error.status === 404 ? "not-found" : "network";
  return <PageState kind={kind} description={classroomMessage(error)} action={<Button onClick={retry}>Thử lại</Button>} />;
}
export function ErrorText({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-lg border border-danger p-3 text-danger">{message}</p> : null;
}
export function Pagination({ result, onPage }: { result: PageResult<unknown>; onPage: (page: number) => void }) {
  return <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-3">
    <p className="text-sm text-muted-foreground">{result.totalElements} mục · Trang {result.page + 1}/{Math.max(1, result.totalPages)}</p>
    <div className="flex gap-2"><Button variant="secondary" disabled={result.page === 0} onClick={() => onPage(result.page - 1)}>Trang trước</Button>
      <Button variant="secondary" disabled={result.page + 1 >= result.totalPages} onClick={() => onPage(result.page + 1)}>Trang sau</Button></div>
  </nav>;
}
export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); trigger?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6 text-foreground backdrop:bg-scrim">
    <div className="mb-4 flex items-start justify-between gap-4"><h2 id={titleId} className="min-w-0 text-xl font-bold [overflow-wrap:anywhere]">{title}</h2><Button variant="ghost" disabled={busy} onClick={onClose}>Đóng</Button></div>
    {children}
  </dialog>;
}
export function Confirm({ title, description, confirmLabel, action, onClose, onDone, onFailed }: {
  title: string; description: string; confirmLabel: string; action: () => Promise<unknown>; onClose: () => void; onDone: () => void; onFailed?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setBusy(true); setError("");
    try { await action(); onDone(); onClose(); } catch (cause) { setError(classroomMessage(cause)); onFailed?.(); } finally { setBusy(false); }
  }
  return <Modal title={title} onClose={onClose} busy={busy}><div className="space-y-4"><p>{description}</p><ErrorText message={error} />
    <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button disabled={busy} onClick={() => void confirm()}>{busy ? "Đang xử lý…" : confirmLabel}</Button></div></div></Modal>;
}
export const membershipImpact = "Bạn sẽ mất quyền bắt đầu bài làm mới thông qua lớp này. Bài đang làm vẫn được hoàn tất; lịch sử bài làm và kết quả được giữ nguyên.";
