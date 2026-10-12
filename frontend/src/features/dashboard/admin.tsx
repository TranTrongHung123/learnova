"use client";

import { LinkButton } from "@/components/ui/button";
import { useApiQuery } from "@/lib/api/use-query";
import { DashboardIntro, DashboardState, Metric, Updated } from "./shared";
import type { AdminDashboard } from "./types";

export function AdminOverview() {
  const query = useApiQuery<AdminDashboard>("/api/v1/admin/dashboard", true, true);
  if (!query.data) return <DashboardState error={query.error} retry={query.reload} />;
  const d = query.data;
  return (
    <div className="space-y-6">
      <DashboardIntro
        label="KHÔNG GIAN QUẢN TRỊ"
        description="Quản lý tài khoản và theo dõi hoạt động hệ thống"
      >
        <LinkButton href="/admin/users">Quản lý người dùng</LinkButton>
        <LinkButton variant="secondary" href="/admin/audit-logs">
          Mở nhật ký hoạt động
        </LinkButton>
      </DashboardIntro>
      <Updated time={d.serverTime} reload={query.reload} refreshing={query.refreshing} />
      <section aria-label="Tài khoản và vai trò">
        <h2 className="mb-4 text-xl font-bold">Tài khoản và vai trò</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Tổng tài khoản" value={d.users} href="/admin/users" />
          <Metric
            label="Tài khoản hoạt động"
            value={d.activeUsers}
            hint="Tài khoản được phép đăng nhập"
            href="/admin/users?status=ACTIVE"
          />
          <Metric
            label="Vai trò PARTICIPANT"
            value={d.participants}
            href="/admin/users?role=PARTICIPANT"
          />
          <Metric label="Vai trò CREATOR" value={d.creators} href="/admin/users?role=CREATOR" />
          <Metric label="Vai trò ADMIN" value={d.admins} href="/admin/users?role=ADMIN" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Một tài khoản có thể có nhiều vai trò. Các nhóm vai trò được đếm độc lập, gồm cả tài
          khoản đã khóa.
        </p>
      </section>
      <section aria-label="Đề thi và kỳ thi">
        <h2 className="mb-4 text-xl font-bold">Đề thi và kỳ thi</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Tổng đề thi" value={d.exams} hint="Bao gồm đề đã lưu trữ" />
          <Metric
            label="Tổng kỳ thi"
            value={d.sessions}
            hint="Bao gồm bản nháp, đã đóng và đã hủy"
          />
          <Metric label="Kỳ thi đang mở" value={d.activeSessions} />
          <Metric label="Kỳ thi sắp diễn ra" value={d.upcomingSessions} />
        </div>
      </section>
    </div>
  );
}
