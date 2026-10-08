"use client";

import { LinkButton } from "@/components/ui/button";
import { useApiQuery } from "@/lib/api/use-query";
import { date } from "@/features/session/shared";
import type { DiscoveredSession, PageResult } from "@/features/discovery/types";
import { notificationTarget } from "@/features/notification/types";
import { DashboardState, Metric, Results, Row, Section, Updated } from "./shared";
import type { ParticipantDashboard } from "./types";

export function ParticipantOverview() {
  const query = useApiQuery<ParticipantDashboard>("/api/v1/participant/dashboard", true);
  if (!query.data) return <DashboardState error={query.error} retry={query.reload} />;
  const d = query.data;
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Tiếp tục bài đang làm, chuẩn bị cho kỳ thi tiếp theo và theo dõi kết quả của bạn.
      </p>
      <div className="flex flex-wrap gap-3">
        <LinkButton href="/participant/exams">Khám phá kỳ thi</LinkButton>
        <LinkButton variant="secondary" href="/participant/classes/join">
          Tham gia lớp
        </LinkButton>
      </div>
      <Updated time={d.serverTime} reload={query.reload} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Kỳ thi có thể làm"
          value={d.available.totalElements}
          href="/participant/exams"
        />
        <Metric
          label="Kỳ thi sắp diễn ra"
          value={d.upcoming.totalElements}
          href="/participant/exams?tab=UPCOMING"
        />
        <Metric
          label="Kỳ thi đã hoàn thành"
          value={d.completed.totalElements}
          href="/participant/exams?tab=COMPLETED"
        />
        <Metric
          label="Điểm trung bình · thang 100"
          value={
            d.scores.averagePercentage === null
              ? "Chưa có điểm"
              : `${d.scores.averagePercentage} / 100`
          }
          hint={`Điểm tốt nhất của ${d.scores.visibleSessionCount} kỳ thi được phép xem; mỗi kỳ thi có trọng số bằng nhau.`}
        />
      </div>
      <Section
        title="Bài đang làm"
        href="/participant/exams"
        empty={!d.inProgress.length ? "Bạn không có bài đang làm còn thời gian." : undefined}
      >
        {d.inProgress.map((a) => (
          <Row
            key={a.id}
            title={a.title}
            href={`/participant/attempts/${a.id}`}
            action="Tiếp tục làm bài"
          >
            <p>Hạn nộp: {date(a.deadline)}</p>
          </Row>
        ))}
      </Section>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Sessions title="Kỳ thi có thể làm" data={d.available} tab="AVAILABLE" />
        <Sessions title="Kỳ thi sắp diễn ra" data={d.upcoming} tab="UPCOMING" />
        <Results items={d.recentResults} />
        <Sessions title="Hoàn thành gần đây" data={d.completed} tab="COMPLETED" />
      </div>
      <Section
        title={`Thông báo · ${d.unreadCount} chưa đọc`}
        href="/notifications"
        empty={!d.notifications.length ? "Bạn chưa có thông báo." : undefined}
      >
        {d.notifications.map((n) => (
          <Row
            key={n.id}
            title={n.title}
            href={notificationTarget(n) ?? "/notifications"}
            action="Mở thông báo"
          >
            <p>{n.message}</p>
            <p>
              {n.readAt ? "Đã đọc" : "Chưa đọc"} · {date(n.createdAt)}
            </p>
          </Row>
        ))}
      </Section>
      <p className="text-sm text-muted-foreground">
        Mỗi danh sách hiển thị tối đa 5 mục. Mở Xem tất cả để xem đầy đủ.
      </p>
    </div>
  );
}

function Sessions({
  title,
  data,
  tab,
}: {
  title: string;
  data: PageResult<DiscoveredSession>;
  tab: string;
}) {
  return (
    <Section
      title={title}
      href={`/participant/exams?tab=${tab}`}
      empty={!data.content.length ? "Chưa có kỳ thi trong nhóm này." : undefined}
    >
      {data.content.map((s) => (
        <Row
          key={s.id}
          title={s.title}
          href={
            s.canContinue && s.activeAttemptId
              ? `/participant/attempts/${s.activeAttemptId}`
              : `/participant/exams/${s.id}`
          }
          action={s.canContinue ? "Tiếp tục làm bài" : "Xem kỳ thi"}
        >
          <p>
            {s.creatorName} · {s.durationMinutes} phút
          </p>
          <p>
            {tab === "UPCOMING" ? "Bắt đầu" : "Kết thúc"}:{" "}
            {date(tab === "UPCOMING" ? s.startTime : s.endTime)}
          </p>
        </Row>
      ))}
    </Section>
  );
}
