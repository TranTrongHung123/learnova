import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Inbox, RefreshCw } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { PageState, Skeleton } from "@/components/ui/page-state";
import { Badge } from "@/components/ui/badge";
import { date, panel } from "@/features/session/shared";
import type { DashboardResult } from "./types";

export function DashboardIntro({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border border-primary/15 bg-muted p-5 sm:p-7"
      aria-label={label}
    >
      <p className="text-xs font-bold tracking-wider text-primary">{label}</p>
      <p className="mt-3 max-w-3xl text-lg leading-8 font-medium">{description}</p>
      <div className="mt-5 flex flex-wrap gap-3" aria-label="Thao tác nhanh">
        {children}
      </div>
    </section>
  );
}

export function Updated({ time, reload }: { time: string; reload: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Cập nhật lúc {date(time)}</p>
      <Button variant="secondary" onClick={reload}>
        <RefreshCw size={16} aria-hidden="true" />
        Làm mới
      </Button>
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  return (
    <div className={`${panel} relative flex min-w-0 flex-col`}>
      <p className="flex items-start gap-2 text-sm font-semibold text-muted-foreground">
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60"
          aria-hidden="true"
        />
        {label}
      </p>
      <p className="my-3 break-words text-4xl font-extrabold tracking-tight tabular-nums">
        {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
      </p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {href && (
        <Link
          className="mt-auto inline-flex min-h-11 items-center gap-2 pt-3 text-sm font-semibold text-primary hover:underline"
          href={href}
        >
          Xem chi tiết<span className="sr-only"> {label}</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function Section({
  title,
  href,
  children,
  empty,
}: {
  title: string;
  href?: string;
  children?: ReactNode;
  empty?: string;
}) {
  return (
    <section className={`${panel} min-w-0`} aria-label={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {href && (
          <LinkButton variant="ghost" href={href}>
            Xem tất cả<span className="sr-only"> {title}</span>
          </LinkButton>
        )}
      </div>
      {empty ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-background p-5 text-center text-sm text-muted-foreground">
          <Inbox size={24} className="text-primary" aria-hidden="true" />
          <p className="max-w-md">{empty}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
    </section>
  );
}

export function Row({
  title,
  href,
  children,
  action = "Xem chi tiết",
}: {
  title: string;
  href: string;
  children?: ReactNode;
  action?: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-48 break-words">
        <h3 className="font-semibold [overflow-wrap:anywhere]">{title}</h3>
        <div className="mt-1 space-y-1 text-sm text-muted-foreground">{children}</div>
      </div>
      <LinkButton variant="secondary" href={href}>
        {action}
        <span className="sr-only">: {title}</span>
      </LinkButton>
    </li>
  );
}

export function Results({
  items,
  creator = false,
}: {
  items: DashboardResult[];
  creator?: boolean;
}) {
  return (
    <Section
      title="Kết quả gần đây"
      href={creator ? "/creator/reports" : "/participant/results"}
      empty={!items.length ? "Chưa có kết quả được phép xem." : undefined}
    >
      {items.map((item) => (
        <Row
          key={item.attemptId}
          title={item.title}
          href={
            creator
              ? `/creator/sessions/${item.sessionId}/results/${item.attemptId}`
              : `/participant/results/${item.attemptId}`
          }
          action="Xem kết quả"
        >
          <p>{date(item.completedAt)}</p>
          <p>
            <span className="font-semibold text-foreground">
              {item.rawScore} / {item.totalScore} điểm
            </span>{" "}
            · <Badge>{item.passed ? "Đạt" : "Chưa đạt"}</Badge>
          </p>
        </Row>
      ))}
    </Section>
  );
}

export function DashboardState({ error, retry }: { error?: unknown; retry: () => void }) {
  if (!error) return <Skeleton />;
  if (error instanceof ApiError && error.status === 403)
    return <PageState kind="forbidden" action={<Button onClick={retry}>Thử lại</Button>} />;
  return (
    <PageState
      kind="network"
      description="Chưa tải được tổng quan. Kiểm tra kết nối và thử lại."
      action={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}
