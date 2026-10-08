"use client";

import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { QueryState, panel, control } from "@/features/session/shared";
import { useMonitoring } from "./use-monitoring";
import type { Participant } from "./types";

const statuses: Record<Participant["status"], string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang làm",
  SUBMITTED: "Đã nộp",
  EXPIRED: "Đã hết giờ",
  GRADED: "Đã chấm",
};

const connections = {
  CONNECTED: "Đang kết nối",
  DISCONNECTED: "Mất kết nối",
  NOT_APPLICABLE: "Không áp dụng",
};

export function Monitoring({ id }: { id: string }) {
  const query = useMonitoring(id);
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  if (!query.data) return <QueryState error={query.error} retry={query.reload} />;
  const s = query.data,
    summary = s.summary;
  const filtered = s.participants.filter((p) =>
    p.displayName.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")),
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 25) - 1));
  const rows = filtered.slice(currentPage * 25, (currentPage + 1) * 25);
  return (
    <div className="space-y-6">
      <LinkButton variant="ghost" href={`/creator/sessions/${id}`}>
        Về kỳ thi
      </LinkButton>
      <header className="space-y-2">
        <h2 className="text-2xl font-bold [overflow-wrap:anywhere]">{s.title}</h2>
        <p>Theo dõi lượt làm mới nhất của mỗi Participant.</p>
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className={query.connected ? "text-success" : "text-warning"}>
            {query.connected
              ? "Đang cập nhật trực tiếp"
              : "Đang kết nối lại · dữ liệu có thể chưa mới nhất"}
          </p>
          <Button variant="secondary" onClick={query.reload}>
            Đồng bộ lại
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Cập nhật lúc {new Date(s.serverTime).toLocaleTimeString("vi-VN")} · Trạng thái kỳ thi:{" "}
          {s.sessionStatus}
        </p>
      </header>
      {s.sessionStatus !== "OPEN" && (
        <p className="rounded-lg bg-muted p-4">
          Kỳ thi hiện không mở. Bạn vẫn có thể xem tiến độ đã ghi nhận.
        </p>
      )}
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [s.accessType === "PUBLIC" ? "Đã tham gia" : "Tổng Participant", summary.total],
          ["Chưa bắt đầu", summary.notStarted ?? "Không áp dụng"],
          ["Đang làm", summary.inProgress],
          ["Đã hoàn tất", summary.submitted],
          ["Mất kết nối", summary.disconnected],
        ].map(([label, value]) => (
          <div key={label} className={panel}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Mất kết nối: không nhận heartbeat trong 45 giây; có thể do mạng hoặc trình duyệt tạm ngưng.
        Đây không phải trạng thái nộp bài hay bằng chứng gian lận. Tiến độ chỉ tính câu trả lời đã
        lưu.
      </p>
      <section className={`${panel} space-y-4`} aria-label="Tiến độ Participant">
        <div>
          <label htmlFor="monitor-search" className="block font-semibold">
            Tìm Participant
          </label>
          <input
            id="monitor-search"
            className={`${control} mt-2 max-w-md`}
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        {!rows.length ? (
          <p>
            {s.participants.length
              ? "Không có Participant phù hợp."
              : "Chưa có Participant tham gia kỳ thi."}
          </p>
        ) : (
          <div role="table" aria-label="Tiến độ làm bài" className="space-y-3">
            <div
              role="row"
              className="sr-only md:not-sr-only md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1.5fr] md:gap-4 md:font-semibold"
            >
              {["Participant", "Bài làm", "Tiến độ", "Kết nối", "Ghi nhận gần nhất"].map((h) => (
                <span role="columnheader" key={h}>
                  {h}
                </span>
              ))}
            </div>
            {rows.map((p) => (
              <div
                role="row"
                key={p.participantId}
                className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[2fr_1fr_1fr_1fr_1.5fr] md:gap-4 md:border-x-0 md:border-b-0 md:p-2"
              >
                <div role="cell" className="min-w-0 [overflow-wrap:anywhere]">
                  <p className="font-semibold">{p.displayName}</p>
                  {p.attemptNumber > 0 && (
                    <p className="text-sm text-muted-foreground">Lượt {p.attemptNumber}</p>
                  )}
                </div>
                <div role="cell">
                  <span className="md:hidden">Bài làm: </span>
                  {statuses[p.status]}
                </div>
                <div role="cell">
                  <span className="md:hidden">Đã trả lời: </span>
                  <span className="tabular-nums">
                    {p.answeredCount} / {p.totalQuestions}
                  </span>
                  <progress
                    aria-label={`Tiến độ ${p.displayName}`}
                    className="mt-2 block h-2 w-full max-w-32 accent-primary"
                    value={p.answeredCount}
                    max={p.totalQuestions || 1}
                  />
                </div>
                <div
                  role="cell"
                  className={
                    p.connectionStatus === "DISCONNECTED"
                      ? "text-warning"
                      : p.connectionStatus === "CONNECTED"
                        ? "text-success"
                        : "text-muted-foreground"
                  }
                >
                  {connections[p.connectionStatus]}
                </div>
                <div role="cell" className="text-sm">
                  <span className="md:hidden">Ghi nhận gần nhất: </span>
                  {p.lastSeen ? new Date(p.lastSeen).toLocaleString("vi-VN") : "Chưa ghi nhận"}
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length > 25 && (
          <nav aria-label="Phân trang Participant" className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Trang trước
            </Button>
            <span>
              Trang {currentPage + 1} / {Math.ceil(filtered.length / 25)}
            </span>
            <Button
              variant="secondary"
              disabled={(currentPage + 1) * 25 >= filtered.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Trang sau
            </Button>
          </nav>
        )}
      </section>
    </div>
  );
}
