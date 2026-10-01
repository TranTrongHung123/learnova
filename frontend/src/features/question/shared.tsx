"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { PageState, Skeleton } from "@/components/ui/page-state";

export const apiRoot = "/api/v1/questions";
export const panel = "rounded-xl border border-border bg-surface p-4 sm:p-6";
export const control = "min-h-11 w-full rounded-lg border border-control-border bg-surface px-3 py-2";
export function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return "Câu hỏi đã thay đổi hoặc không còn cho phép thao tác này. Hãy tải lại dữ liệu mới nhất; nội dung đang nhập vẫn được giữ để bạn đối chiếu.";
    if (error.status === 400) return "Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường bên dưới.";
    return error.message;
  }
  return "Không thể kết nối. Nội dung chưa được lưu, hãy thử lại.";
}
export function useQuestion<T>(path: string) {
  const { session } = useAuth();
  const [revision, setRevision] = useState(0);
  const key = `${path}:${revision}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: unknown }>({ key: "" });
  useEffect(() => {
    const controller = new AbortController();
    session.api.request<T>(path, { signal: controller.signal }).then(
      data => { if (!controller.signal.aborted) setResult({ key, data }); },
      error => { if (!controller.signal.aborted) setResult({ key, error }); },
    );
    return () => controller.abort();
  }, [session, path, key]);
  return { data: result.key === key ? result.data : undefined, error: result.key === key ? result.error : undefined, reload: () => setRevision(n => n + 1) };
}
export function QueryState({ error, retry }: { error?: unknown; retry: () => void }) {
  if (!error) return <Skeleton />;
  return <PageState kind={error instanceof ApiError && error.status === 404 ? "not-found" : error instanceof ApiError && error.status === 403 ? "forbidden" : "network"}
    description={message(error)} action={<Button onClick={retry}>Thử lại</Button>} />;
}
export function Field({ name, label, error, children }: { name: string; label: string; error?: string; children: ReactNode }) {
  return <div className="space-y-2"><label htmlFor={name} className="block text-sm font-semibold">{label}</label>{children}
    {error && <p id={`${name}-error`} className="text-sm text-danger">{error}</p>}</div>;
}
