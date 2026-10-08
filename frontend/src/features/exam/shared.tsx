"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { PageState, Skeleton } from "@/components/ui/page-state";
import { Button } from "@/components/ui/button";

export { panel, control, Field } from "@/features/question/shared";

export function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.problem?.code === "EXAM_EMPTY_VERSION")
      return "Thêm ít nhất một câu hỏi trước khi xuất bản.";
    if (error.problem?.code === "EXAM_DUPLICATE_QUESTION")
      return "Câu hỏi đã có trong bản nháp. Hãy tải lại dữ liệu mới nhất.";
    if (error.status === 409)
      return "Dữ liệu đã thay đổi hoặc phiên bản đã xuất bản. Nội dung đang nhập vẫn được giữ; tải lại để đối chiếu trước khi tiếp tục.";
    if (error.status === 400) return "Thông tin chưa hợp lệ. Kiểm tra điểm và các trường bên dưới.";
    return error.message;
  }
  return error instanceof Error && !(error instanceof TypeError)
    ? error.message
    : "Không thể kết nối. Chưa xác nhận lưu thành công; hãy kiểm tra lại.";
}

export function QueryState({ error, retry }: { error?: unknown; retry: () => void }) {
  if (!error) return <Skeleton />;
  return (
    <PageState
      kind={
        error instanceof ApiError && error.status === 404
          ? "not-found"
          : error instanceof ApiError && error.status === 403
            ? "forbidden"
            : "network"
      }
      description={message(error)}
      action={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}

export function Modal({
  title,
  children,
  close,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement,
      element = ref.current;
    element?.showModal();
    return () => {
      element?.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-auto rounded-xl border border-border bg-surface p-4 text-foreground backdrop:bg-scrim sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <Button variant="ghost" disabled={busy} onClick={close}>
          Đóng
        </Button>
      </div>
      {children}
    </dialog>
  );
}
