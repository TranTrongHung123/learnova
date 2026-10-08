"use client";

import { SessionList } from "@/features/session/session-list";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useApiQuery } from "@/lib/api/use-query";
import { Button, LinkButton } from "@/components/ui/button";
import { message, Modal, panel, QueryState } from "./shared";
import { examLabel, versionLabel, versionPath, type ExamDetail, type VersionDetail } from "./types";

export function ExamScreen({ id }: { id: string }) {
  const query = useApiQuery<ExamDetail>(`/api/v1/exams/${id}`);
  const { session } = useAuth(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [archive, setArchive] = useState(false);
  async function create(baseVersionId: string | null) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const v = await session.api.request<VersionDetail>(`/api/v1/exams/${id}/versions`, {
        method: "POST",
        json: { baseVersionId },
      });
      router.push(versionPath(id, v.id, true));
    } catch (cause) {
      setError(message(cause));
      setBusy(false);
    }
  }
  if (!query.data) return <QueryState error={query.error} retry={query.reload} />;
  const e = query.data;
  return (
    <div className="space-y-6">
      <LinkButton variant="ghost" href="/creator/exams">
        Quay lại danh sách đề
      </LinkButton>
      <section className={`${panel} space-y-3 [overflow-wrap:anywhere]`}>
        <h2 className="text-2xl font-bold">{e.name}</h2>
        <p>{examLabel[e.status]}</p>
        <p className="whitespace-pre-wrap">{e.description || "Chưa có mô tả."}</p>
        {e.status === "ARCHIVED" && (
          <p>Đề đã lưu trữ không dùng để tạo kỳ thi mới. Bạn vẫn có thể biên soạn phiên bản.</p>
        )}
      </section>
      {error && !archive && (
        <div role="alert" className="text-danger">
          <p>{error}</p>
          <Button variant="secondary" onClick={query.reload}>
            Tải lại
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void create(null)}>
          Tạo bản nháp trống
        </Button>
        {e.status === "ACTIVE" && (
          <Button variant="secondary" disabled={busy} onClick={() => setArchive(true)}>
            Lưu trữ đề
          </Button>
        )}
      </div>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Lịch sử phiên bản</h2>
        {e.versions.map((v) => (
          <article
            key={v.id}
            className={`${panel} flex flex-wrap items-center justify-between gap-4`}
          >
            <div>
              <h3 className="font-bold">
                Phiên bản {v.versionNumber} — {versionLabel[v.status]}
              </h3>
              <p>
                {v.questionCount} câu hỏi · {v.totalScore} điểm
              </p>
              {v.publishedAt && (
                <p className="text-sm text-muted-foreground">
                  Xuất bản: {new Date(v.publishedAt).toLocaleString("vi-VN")}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {v.status === "PUBLISHED" && e.status === "ACTIVE" && (
                <LinkButton href={`/creator/sessions/new?examId=${id}&versionId=${v.id}`}>
                  Tạo kỳ thi
                </LinkButton>
              )}
              <LinkButton variant="secondary" href={versionPath(id, v.id, v.status === "DRAFT")}>
                {v.status === "DRAFT" ? "Sửa bản nháp" : "Xem phiên bản"}
              </LinkButton>
              {v.status === "PUBLISHED" && (
                <Button variant="secondary" disabled={busy} onClick={() => void create(v.id)}>
                  Tạo bản nháp từ phiên bản {v.versionNumber}
                </Button>
              )}
            </div>
          </article>
        ))}
      </section>
      <SessionList examId={id} compact />
      {archive && (
        <Modal title="Lưu trữ đề thi?" close={() => setArchive(false)} busy={busy}>
          <p className="mb-4">
            Đề sẽ không dùng để tạo kỳ thi mới. Các phiên bản và lịch sử được giữ nguyên.
          </p>
          {error && (
            <p role="alert" className="mb-4 text-danger">
              {error}
            </p>
          )}
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await session.api.request(`/api/v1/exams/${id}/archive`, {
                  method: "POST",
                  json: { revision: e.revision },
                });
                setArchive(false);
                query.reload();
              } catch (cause) {
                setError(message(cause));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Đang lưu trữ…" : "Xác nhận lưu trữ"}
          </Button>
        </Modal>
      )}
    </div>
  );
}
