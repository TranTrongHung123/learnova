"use client";

import { useState } from "react";
import { StartAttempt } from "@/features/attempt/start";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApiQuery } from "@/lib/api/use-query";
import { Button, LinkButton } from "@/components/ui/button";
import { PageState, Skeleton } from "@/components/ui/page-state";
import { ApiError } from "@/lib/api/client";
import { Pagination } from "@/features/classroom/shared";
import { panel, date } from "@/features/session/shared";
import { accessLabels, statusLabels } from "@/features/session/types";
import {
  apiRoot,
  filters,
  tabs,
  reasons,
  type DiscoveredSession,
  type PageResult,
  type AttemptMetadata,
} from "./types";

function QueryState({ error, retry }: { error?: unknown; retry: () => void }) {
  if (!error) return <Skeleton />;
  const kind =
    error instanceof ApiError && error.status === 404
      ? "not-found"
      : error instanceof ApiError && error.status === 403
        ? "forbidden"
        : "network";
  return (
    <PageState
      kind={kind}
      description={
        kind === "network"
          ? "Không tải được dữ liệu kỳ thi. Kiểm tra kết nối và thử lại."
          : undefined
      }
      action={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}

function Availability({ value: s }: { value: DiscoveredSession }) {
  return (
    <div className="space-y-2">
      {s.canContinue ? (
        <>
          <p className="text-success">Bạn có bài đang làm và còn thời gian để tiếp tục.</p>
          <StartAttempt value={s} />
        </>
      ) : s.canStart ? (
        <>
          <p className="text-success">Bạn đủ điều kiện bắt đầu theo lần kiểm tra mới nhất.</p>
          <StartAttempt value={s} />
        </>
      ) : (
        <p className="text-muted-foreground">
          {reasons[s.unavailableReason ?? ""] ?? "Hiện chưa thể bắt đầu bài thi."}
        </p>
      )}
    </div>
  );
}

function Schedule({ value: s }: { value: DiscoveredSession }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Bắt đầu</dt>
        <dd>{date(s.startTime)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Kết thúc</dt>
        <dd>{date(s.endTime)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Thời lượng</dt>
        <dd>{s.durationMinutes} phút</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Lượt đã dùng / tối đa</dt>
        <dd>
          {s.attemptsUsed} / {s.maxAttempts}
        </dd>
      </div>
    </dl>
  );
}

export function DiscoveryList() {
  const search = useSearchParams(),
    router = useRouter();
  const { tab, page } = filters(search);
  const queryString = new URLSearchParams({ tab, page: String(page) }).toString();
  const query = useApiQuery<PageResult<DiscoveredSession>>(`${apiRoot}?${queryString}`, true);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          Các kỳ thi bạn được tham gia và lịch sử bài làm của bạn.
        </p>
        <Button variant="secondary" onClick={query.reload}>
          Làm mới
        </Button>
      </div>
      <nav aria-label="Nhóm kỳ thi" className="flex flex-wrap gap-2">
        {Object.entries(tabs).map(([key, label]) => (
          <Link
            key={key}
            href={`?tab=${key}&page=0`}
            aria-current={key === tab ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 font-semibold ${key === tab ? "border-primary bg-primary text-on-primary" : "border-control-border bg-surface hover:bg-muted"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">
        Một kỳ thi có thể xuất hiện ở nhiều nhóm nếu bạn đã hoàn thành một lượt và vẫn còn lượt làm.
      </p>
      {!query.data ? (
        <QueryState error={query.error} retry={query.reload} />
      ) : (
        <>
          {!query.data.content.length && (
            <PageState
              kind="empty"
              title="Chưa có kỳ thi trong nhóm này"
              description="Chọn nhóm khác hoặc làm mới để kiểm tra kỳ thi được giao."
            />
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            {query.data.content.map((s) => (
              <article key={s.id} className={`${panel} min-w-0 space-y-4 [overflow-wrap:anywhere]`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-xl font-bold">{s.title}</h2>
                  <span className="rounded bg-muted px-3 py-1 text-sm">
                    {statusLabels[s.status]}
                  </span>
                </div>
                <p>
                  Người tạo: {s.creatorName} · {accessLabels[s.accessType]}
                </p>
                <Schedule value={s} />
                <Availability value={s} />
                <LinkButton variant="secondary" href={`/participant/exams/${s.id}?${queryString}`}>
                  Xem chi tiết<span className="sr-only"> {s.title}</span>
                </LinkButton>
              </article>
            ))}
          </div>
          <Pagination result={query.data} onPage={(p) => router.push(`?tab=${tab}&page=${p}`)} />
        </>
      )}
    </section>
  );
}

const attemptLabels = {
  IN_PROGRESS: "Đang làm",
  SUBMITTED: "Đã nộp",
  EXPIRED: "Hết thời gian",
  GRADED: "Đã chấm",
};

function History({ id }: { id: string }) {
  const [page, setPage] = useState(0);
  const query = useApiQuery<PageResult<AttemptMetadata>>(
    `${apiRoot}/${id}/attempts?page=${page}`,
    true,
  );
  return (
    <section aria-labelledby="history-title" className="space-y-4">
      <h2 id="history-title" className="text-xl font-bold">
        Lịch sử bài làm
      </h2>
      <p className="text-sm text-muted-foreground">
        Lịch sử được giữ lại kể cả khi bạn không còn là thành viên lớp. Kết quả tuân theo chính sách
        công bố của kỳ thi.
      </p>
      {!query.data ? (
        <QueryState error={query.error} retry={query.reload} />
      ) : (
        <>
          {query.data.content.length === 0 ? (
            <p className={panel}>Bạn chưa có bài làm trong kỳ thi này.</p>
          ) : (
            query.data.content.map((a) => (
              <article key={a.id} className={`${panel} space-y-3`}>
                <h3 className="font-bold">
                  Lượt {a.attemptNumber} · {attemptLabels[a.status]}
                </h3>
                <p>Bắt đầu: {date(a.startedAt)}</p>
                <p>Hạn làm bài: {date(a.deadline)}</p>
                {a.submittedAt && <p>Nộp bài: {date(a.submittedAt)}</p>}
                {a.status !== "IN_PROGRESS" && (
                  <LinkButton variant="secondary" href={`/participant/results/${a.id}`}>
                    Xem kết quả
                  </LinkButton>
                )}
              </article>
            ))
          )}
          <Pagination result={query.data} onPage={setPage} />
        </>
      )}
    </section>
  );
}

const displayLabels = {
  HIDDEN: "Ẩn kết quả",
  SCORE_ONLY: "Chỉ điểm số",
  SUMMARY: "Tóm tắt",
  DETAILED: "Chi tiết",
};

const releaseLabels = {
  IMMEDIATE: "Ngay sau khi hoàn tất",
  AFTER_SESSION_END: "Sau khi kỳ thi kết thúc",
  MANUAL: "Khi người tạo công bố",
};

export function DiscoveryDetail({ id }: { id: string }) {
  const search = useSearchParams(),
    { tab, page } = filters(search);
  const query = useApiQuery<DiscoveredSession>(`${apiRoot}/${id}`, true),
    s = query.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <LinkButton variant="secondary" href={`/participant/exams?tab=${tab}&page=${page}`}>
          Về kỳ thi của tôi
        </LinkButton>
        <Button variant="secondary" onClick={query.reload}>
          Làm mới
        </Button>
      </div>
      {!s ? (
        <QueryState error={query.error} retry={query.reload} />
      ) : (
        <>
          <section className={`${panel} space-y-5 [overflow-wrap:anywhere]`}>
            <div>
              <h2 className="text-2xl font-bold">{s.title}</h2>
              <p className="mt-2 text-muted-foreground">
                Người tạo: {s.creatorName} · {accessLabels[s.accessType]} · {statusLabels[s.status]}
              </p>
            </div>
            {s.description && <p className="whitespace-pre-wrap">{s.description}</p>}
            <Schedule value={s} />
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Số câu hỏi</dt>
                <dd className="text-xl font-bold">{s.questionCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tổng điểm</dt>
                <dd className="text-xl font-bold">{s.totalScore}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Điểm đạt</dt>
                <dd className="text-xl font-bold">{s.passingScore}</dd>
              </div>
            </dl>
            <Availability value={s} />
            <p className="text-sm text-muted-foreground">
              Hạn làm bài được máy chủ chốt khi bắt đầu: thời điểm sớm hơn giữa hết thời lượng và
              giờ kết thúc kỳ thi.
            </p>
            <p className="text-sm">
              Chính sách kết quả: {displayLabels[s.resultDisplayMode]} ·{" "}
              {releaseLabels[s.resultReleasePolicy]}.
            </p>
            <p className="text-sm text-muted-foreground">
              Máy chủ kiểm tra lúc {date(s.serverTime)}. Điều kiện sẽ được kiểm tra lại khi bắt đầu
              bài thi.
            </p>
          </section>
          <History key={id} id={id} />
        </>
      )}
    </div>
  );
}
