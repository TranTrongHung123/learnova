"use client";

import { LinkButton } from "@/components/ui/button";
import { useApiQuery } from "@/lib/api/use-query";
import { date } from "@/features/session/shared";
import { DashboardState, Metric, Results, Row, Section, Updated } from "./shared";
import type { CreatorDashboard } from "./types";

export function CreatorOverview() {
  const query = useApiQuery<CreatorDashboard>("/api/v1/creator/dashboard", true);
  if (!query.data) return <DashboardState error={query.error} retry={query.reload} />;
  const d = query.data;
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Tổng quan ngân hàng câu hỏi, đề thi và các kỳ thi do bạn tổ chức.
      </p>
      <div className="flex flex-wrap gap-3" aria-label="Thao tác nhanh">
        <LinkButton href="/creator/questions/new">Tạo câu hỏi</LinkButton>
        <LinkButton variant="secondary" href="/creator/questions/import">
          Nhập Excel
        </LinkButton>
        <LinkButton variant="secondary" href="/creator/exams/new">
          Tạo đề thi
        </LinkButton>
        <LinkButton variant="secondary" href="/creator/sessions/new">
          Tạo kỳ thi
        </LinkButton>
        <LinkButton variant="secondary" href="/creator/monitor">
          Mở giám sát
        </LinkButton>
      </div>
      <Updated time={d.serverTime} reload={query.reload} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Tổng câu hỏi" value={d.counts.questions} href="/creator/questions" />
        <Metric label="Tổng đề thi" value={d.counts.exams} href="/creator/exams" />
        <Metric label="Kỳ thi đang mở" value={d.counts.activeSessions} href="/creator/monitor" />
        <Metric
          label="Người tham gia"
          value={d.counts.participants}
          hint="Số người được giao hoặc đã có bài làm, không đếm trùng giữa các kỳ thi."
        />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Section
          title="Kỳ thi đang mở"
          href="/creator/monitor"
          empty={!d.activeSessions.length ? "Chưa có kỳ thi đang mở." : undefined}
        >
          {d.activeSessions.map((s) => (
            <Row
              key={s.id}
              title={s.title}
              href={`/creator/sessions/${s.id}/monitor`}
              action="Giám sát"
            >
              <p>Kết thúc: {date(s.endTime)}</p>
            </Row>
          ))}
        </Section>
        <Section
          title={`Kỳ thi sắp diễn ra · ${d.counts.upcomingSessions}`}
          href="/creator/sessions"
          empty={
            !d.upcomingSessions.length
              ? "Chưa có kỳ thi sắp diễn ra. Tạo kỳ thi và lên lịch để bắt đầu."
              : undefined
          }
        >
          {d.upcomingSessions.map((s) => (
            <Row key={s.id} title={s.title} href={`/creator/sessions/${s.id}`}>
              <p>Bắt đầu: {date(s.startTime)}</p>
            </Row>
          ))}
        </Section>
        <Section
          title="Đề thi gần đây"
          href="/creator/exams"
          empty={
            !d.recentExams.length
              ? "Chưa có đề thi. Tạo đề thi đầu tiên từ thao tác nhanh."
              : undefined
          }
        >
          {d.recentExams.map((e) => (
            <Row key={e.id} title={e.name} href={`/creator/exams/${e.id}`}>
              <p>{e.status === "ARCHIVED" ? "Đã lưu trữ" : "Đang sử dụng"}</p>
            </Row>
          ))}
        </Section>
        <Results items={d.recentResults} creator />
      </div>
      <section aria-label="Thống kê ngân hàng câu hỏi">
        <h2 className="mb-4 text-xl font-bold">Thống kê ngân hàng câu hỏi</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Bản nháp" value={d.questionCounts.draft} />
          <Metric label="Sẵn sàng sử dụng" value={d.questionCounts.active} />
          <Metric label="Đã lưu trữ" value={d.questionCounts.archived} />
        </div>
      </section>
      <p className="text-sm text-muted-foreground">
        Tổng số gồm cả dữ liệu đã lưu trữ. Mỗi danh sách hiển thị tối đa 5 mục mới nhất hoặc gần đến
        hạn nhất.
      </p>
    </div>
  );
}
