"use client";
import { LinkButton } from "@/components/ui/button";
import { useApiQuery } from "@/lib/api/use-query";
import { DashboardState, Metric, Updated } from "./shared";
import type { AdminDashboard } from "./types";

export function AdminOverview() {
  const query = useApiQuery<AdminDashboard>("/api/v1/admin/dashboard", true);
  if (!query.data) return <DashboardState error={query.error} retry={query.reload} />;
  const d = query.data;
  return <div className="space-y-6">
    <p className="text-muted-foreground">Theo dõi quy mô hệ thống và truy cập các công cụ quản trị.</p>
    <div className="flex flex-wrap gap-3"><LinkButton href="/admin/users">Quản lý người dùng</LinkButton><LinkButton variant="secondary" href="/admin/audit-logs">Mở nhật ký hoạt động</LinkButton></div>
    <Updated time={d.serverTime} reload={query.reload} />
    <section aria-label="Tài khoản và vai trò"><h2 className="mb-4 text-xl font-bold">Tài khoản và vai trò</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Metric label="Tổng tài khoản" value={d.users} href="/admin/users" />
      <Metric label="Tài khoản ACTIVE" value={d.activeUsers} hint="Tài khoản có trạng thái ACTIVE; không phải số người đang online." href="/admin/users?status=ACTIVE" />
      <Metric label="Vai trò PARTICIPANT" value={d.participants} href="/admin/users?role=PARTICIPANT" />
      <Metric label="Vai trò CREATOR" value={d.creators} href="/admin/users?role=CREATOR" />
      <Metric label="Vai trò ADMIN" value={d.admins} href="/admin/users?role=ADMIN" />
    </div><p className="mt-3 text-sm text-muted-foreground">Một tài khoản có thể có nhiều vai trò. Các nhóm vai trò được đếm độc lập, gồm cả tài khoản đã khóa.</p></section>
    <section aria-label="Đề thi và kỳ thi"><h2 className="mb-4 text-xl font-bold">Đề thi và kỳ thi</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Tổng đề thi" value={d.exams} hint="Bao gồm đề đã lưu trữ." /><Metric label="Tổng kỳ thi" value={d.sessions} hint="Bao gồm bản nháp, đã đóng và đã hủy." /><Metric label="Kỳ thi đang mở" value={d.activeSessions} /><Metric label="Kỳ thi sắp diễn ra" value={d.upcomingSessions} /></div></section>
  </div>;
}
