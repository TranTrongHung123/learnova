"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { apiRoot, message, panel, QueryState, useQuestion } from "./shared";
import { difficultyLabels, statusLabels, typeLabels, type QuestionDetail } from "./types";
import { QuestionForm } from "./question-form";

export function QuestionScreen({ id, edit = false }: { id: string; edit?: boolean }) {
  const query = useQuestion<QuestionDetail>(`${apiRoot}/${id}`);
  const [notice, setNotice] = useState("");
  if (!query.data) return <QueryState error={query.error} retry={query.reload} />;
  if (edit && query.data.status !== "ARCHIVED")
    return <QuestionForm key={`${id}:${query.data.revision}`} existing={query.data} />;
  return (
    <Detail question={query.data} reload={query.reload} notice={notice} onNotice={setNotice} />
  );
}

function Detail({
  question: q,
  reload,
  notice,
  onNotice,
}: {
  question: QuestionDetail;
  reload: () => void;
  notice: string;
  onNotice: (value: string) => void;
}) {
  const { session } = useAuth();
  const params = useSearchParams();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!confirm) return;
    const trigger = document.activeElement as HTMLElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      trigger?.focus();
    };
  }, [confirm]);
  async function transition(action: "archive" | "restore") {
    setBusy(true);
    setError("");
    onNotice("");
    try {
      const result = await session.api.request<QuestionDetail>(`${apiRoot}/${q.id}/${action}`, {
        method: "POST",
        json: { revision: q.revision },
      });
      setConfirm(false);
      onNotice(`Đã cập nhật: ${statusLabels[result.status]}.`);
      reload();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-4xl space-y-5">
      <LinkButton variant="ghost" href="/creator/questions">
        Quay lại ngân hàng câu hỏi
      </LinkButton>
      {(notice || params.has("saved")) && (
        <p role="status" className="text-success">
          {notice || "Đã lưu câu hỏi."}
        </p>
      )}
      {error && !confirm && (
        <div role="alert" className="space-y-2 text-danger">
          <p>{error}</p>
          <Button variant="secondary" onClick={reload}>
            Tải lại
          </Button>
        </div>
      )}
      <article className={`${panel} space-y-5 [overflow-wrap:anywhere]`}>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded bg-muted px-3 py-1">{statusLabels[q.status]}</span>
          <span>{typeLabels[q.type]}</span>
          <span>{q.difficulty ? difficultyLabels[q.difficulty] : "Chưa phân loại độ khó"}</span>
        </div>
        <h2 className="whitespace-pre-wrap text-xl font-bold">
          {q.content || "Câu hỏi chưa có nội dung"}
        </h2>
        {q.options.length > 0 && (
          <ol className="space-y-2">
            {q.options.map((o, i) => (
              <li key={i} className="whitespace-pre-wrap rounded-lg border border-border p-3">
                {i + 1}. {o.content || "Chưa nhập lựa chọn"}
                {o.correct && <strong className="ml-3 text-success">Đáp án đúng</strong>}
              </li>
            ))}
          </ol>
        )}
        {q.type === "TRUE_FALSE" && (
          <p>
            Đáp án:{" "}
            <strong>
              {q.correctBoolean === null ? "Chưa chọn" : q.correctBoolean ? "Đúng" : "Sai"}
            </strong>
          </p>
        )}
        {q.type === "NUMERIC_ANSWER" && (
          <div>
            <p>
              Đáp án số: <strong>{q.correctValue ?? "Chưa nhập"}</strong>
            </p>
            <p>Sai số tuyệt đối: {q.tolerance}</p>
          </div>
        )}
        <section>
          <h3 className="font-semibold">Giải thích</h3>
          <p className="whitespace-pre-wrap">{q.explanation || "Chưa có giải thích."}</p>
        </section>
        <p>Danh mục: {q.category || "Chưa phân loại"}</p>
        <p>Nhãn / chủ đề: {q.tags.join(", ") || "Chưa có"}</p>
        <p className="text-sm text-muted-foreground">
          Cập nhật: {new Date(q.updatedAt).toLocaleString("vi-VN")}
        </p>
      </article>
      {q.status === "ARCHIVED" && (
        <p>
          Câu hỏi đã lưu trữ chỉ có thể xem hoặc khôi phục. Nếu chưa đủ đáp án, câu hỏi được khôi
          phục về bản nháp.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {q.status === "ARCHIVED" ? (
          <Button disabled={busy} onClick={() => void transition("restore")}>
            {busy ? "Đang xử lý…" : "Khôi phục"}
          </Button>
        ) : (
          <>
            <LinkButton href={`/creator/questions/${q.id}/edit`}>Chỉnh sửa</LinkButton>
            <Button variant="secondary" onClick={() => setConfirm(true)}>
              Lưu trữ
            </Button>
          </>
        )}
      </div>
      {confirm && (
        <dialog
          ref={dialog}
          aria-labelledby="archive-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) setConfirm(false);
          }}
          className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-xl border border-border bg-surface p-6 text-foreground backdrop:bg-scrim"
        >
          <h2 id="archive-title" className="text-xl font-bold">
            Lưu trữ câu hỏi?
          </h2>
          <p className="my-4">Câu hỏi sẽ không dùng được cho đề mới. Lịch sử được giữ nguyên.</p>
          {error && (
            <p role="alert" className="mb-4 text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => void transition("archive")}>
              Xác nhận lưu trữ
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>
              Hủy
            </Button>
          </div>
        </dialog>
      )}
    </div>
  );
}
