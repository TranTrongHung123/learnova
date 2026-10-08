"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import type { DiscoveredSession } from "@/features/discovery/types";
import type { Attempt } from "./types";

export function StartAttempt({ value: s }: { value: DiscoveredSession }) {
  const { session } = useAuth(),
    router = useRouter(),
    title = useId();
  const dialog = useRef<HTMLDialogElement>(null),
    inFlight = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const a = await session.api.request<Attempt>(`/api/v1/exam-sessions/${s.id}/attempts`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });
      router.push(`/participant/attempts/${a.id}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 409
          ? "Điều kiện kỳ thi đã thay đổi. Đóng hộp thoại và làm mới để kiểm tra."
          : "Chưa xác nhận bắt đầu bài. Thử lại sẽ tiếp tục cùng bài nếu máy chủ đã tạo.",
      );
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (s.canContinue && s.activeAttemptId)
    return (
      <LinkButton href={`/participant/attempts/${s.activeAttemptId}`}>Tiếp tục làm bài</LinkButton>
    );
  return (
    <>
      <Button onClick={() => dialog.current?.showModal()}>Bắt đầu làm bài</Button>
      <dialog
        ref={dialog}
        aria-labelledby={title}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-xl border border-border bg-surface p-6 text-foreground backdrop:bg-scrim"
      >
        <h2 id={title} className="text-xl font-bold">
          Bắt đầu {s.title}?
        </h2>
        <p className="my-4">
          Thời lượng {s.durationMinutes} phút. Bạn đã dùng {s.attemptsUsed}/{s.maxAttempts} lượt.
          Hạn làm bài là thời điểm sớm hơn giữa hết thời lượng và giờ kết thúc kỳ thi.
        </p>
        <p>
          Câu trả lời được tự động lưu khi máy chủ xác nhận. Phần chưa lưu có thể mất khi tải lại
          hoặc đóng trình duyệt.
        </p>
        <p className="mt-3 text-muted-foreground">
          Khi hết giờ, máy chủ tự kết thúc và chấm các câu trả lời đã lưu, kể cả khi bạn đóng trình
          duyệt.
        </p>
        {error && (
          <p role="alert" className="my-3 text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => dialog.current?.close()}>
            Hủy
          </Button>
          <Button disabled={busy} onClick={() => void start()}>
            {busy ? "Đang bắt đầu…" : "Bắt đầu ngay"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
