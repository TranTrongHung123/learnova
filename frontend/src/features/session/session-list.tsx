"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApiQuery } from "@/lib/api/use-query";
import { Button, LinkButton } from "@/components/ui/button";
import { Pagination } from "@/features/classroom/shared";
import {
  apiRoot,
  path,
  statusLabels,
  accessLabels,
  type Status,
  type SessionDetail,
  type PageResult,
} from "./types";
import { panel, QueryState, date } from "./shared";

export function SessionList({
  examId,
  classroomId,
  compact = false,
  monitoring = false,
  reporting = false,
}: {
  examId?: string;
  classroomId?: string;
  compact?: boolean;
  monitoring?: boolean;
  reporting?: boolean;
}) {
  const search = useSearchParams();
  const requestedStatus = monitoring ? "OPEN" : search.get("status");
  const [status, setStatus] = useState<Status | "">(
      !compact && requestedStatus && requestedStatus in statusLabels
        ? (requestedStatus as Status)
        : "",
    ),
    [page, setPage] = useState(0);
  const params = new URLSearchParams({ page: String(page), size: compact ? "5" : "20" });
  if (status) params.set("status", status);
  if (examId) params.set("examId", examId);
  const selectedClass = classroomId ?? (!compact ? search.get("classroomId") : null);
  if (selectedClass) params.set("classroomId", selectedClass);
  const query = useApiQuery<PageResult<SessionDetail>>(`${apiRoot}?${params}`);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{compact ? "Kỳ thi liên quan" : "Kỳ thi của bạn"}</h2>
        {!reporting && (
          <LinkButton href={`/creator/sessions/new${examId ? `?examId=${examId}` : ""}`}>
            Tạo kỳ thi
          </LinkButton>
        )}
      </div>
      {reporting && <p>Chọn kỳ thi để xem thống kê, kết quả hoặc xuất Excel.</p>}
      <nav aria-label="Lọc trạng thái kỳ thi" className="flex flex-wrap gap-2">
        {(["", ...Object.keys(statusLabels)] as (Status | "")[]).map((s) => (
          <Button
            key={s}
            variant={status === s ? "primary" : "secondary"}
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setPage(0);
            }}
          >
            {s ? statusLabels[s] : "Tất cả"}
          </Button>
        ))}
      </nav>
      {!query.data ? (
        <QueryState error={query.error} retry={query.reload} />
      ) : (
        <>
          {query.data.content.length === 0 && <p className={panel}>Chưa có kỳ thi phù hợp.</p>}
          <div className="grid gap-4">
            {query.data.content.map((s) => (
              <article key={s.id} className={`${panel} space-y-3 [overflow-wrap:anywhere]`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  <span className="rounded bg-muted px-3 py-1">{statusLabels[s.status]}</span>
                </div>
                <p>
                  {s.examName} · Phiên bản {s.versionNumber} · {accessLabels[s.accessType]}
                </p>
                <p className="text-sm">
                  {date(s.startTime)} → {date(s.endTime)}
                </p>
                <p>
                  {s.assignedParticipantCount === null
                    ? "Công khai cho người tham gia đã đăng nhập"
                    : `${s.assignedParticipantCount} người được giao`}
                </p>
                <LinkButton variant="secondary" href={path(s.id)}>
                  Xem kỳ thi<span className="sr-only"> {s.title}</span>
                </LinkButton>
                {reporting && (
                  <div className="flex flex-wrap gap-3">
                    <LinkButton href={`${path(s.id)}/analytics`}>
                      Xem thống kê<span className="sr-only"> {s.title}</span>
                    </LinkButton>
                    <LinkButton variant="secondary" href={`${path(s.id)}/results`}>
                      Xem kết quả<span className="sr-only"> {s.title}</span>
                    </LinkButton>
                  </div>
                )}
                {s.status === "OPEN" && (
                  <LinkButton variant="secondary" href={`${path(s.id)}/monitor`}>
                    Giám sát<span className="sr-only"> {s.title}</span>
                  </LinkButton>
                )}
              </article>
            ))}
          </div>
          <Pagination result={query.data} onPage={setPage} />
        </>
      )}
    </section>
  );
}
