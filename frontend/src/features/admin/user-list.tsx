"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { useApiQuery } from "@/lib/api/use-query";
import { control, date, Field, Pagination, panel, QueryState, StatusAction, usersApi, UserStatus } from "./shared";
import { statusLabels, type AdminUser, type UserPage } from "./types";

export function UserList() {
  const params = useSearchParams(), router = useRouter();
  const query = useApiQuery<UserPage>(`${usersApi}?${params}`);
  const [notice, setNotice] = useState("");
  function completed() { setNotice("Đã cập nhật trạng thái tài khoản và ghi nhật ký."); query.reload(); }
  function page(value: number) { const next = new URLSearchParams(params); next.set("page", String(value)); router.push(`/admin/users?${next}`); }
  return <section aria-label="Danh sách người dùng" className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-muted-foreground">Tra cứu tài khoản, quản lý quyền tham gia và tạo kỳ thi. Mọi thay đổi quyền và trạng thái đều được ghi nhật ký.</p><Button variant="secondary" onClick={query.reload}>Làm mới</Button></div>
    <form key={params.toString()} className={`${panel} grid gap-4 sm:grid-cols-2 xl:grid-cols-3`} onSubmit={event => {
      event.preventDefault(); const next = new URLSearchParams();
      new FormData(event.currentTarget).forEach((value, key) => { if (String(value).trim()) next.set(key, String(value).trim()); });
      setNotice(""); router.push(`/admin/users?${next}`);
    }}>
      <Field id="search" label="Tìm email hoặc tên"><input id="search" name="search" className={control} defaultValue={params.get("search") ?? ""} maxLength={254} /></Field>
      <Field id="role" label="Vai trò"><select id="role" name="role" className={control} defaultValue={params.get("role") ?? ""}><option value="">Tất cả vai trò</option>{["PARTICIPANT", "CREATOR", "ADMIN"].map(role => <option key={role}>{role}</option>)}</select></Field>
      <Field id="status" label="Trạng thái"><select id="status" name="status" className={control} defaultValue={params.get("status") ?? ""}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-3"><Button type="submit">Tìm kiếm / Lọc</Button><LinkButton variant="ghost" href="/admin/users">Xóa bộ lọc</LinkButton></div>
    </form>
    {notice && <p role="status" className="text-success">{notice}</p>}
    {!query.data ? <QueryState error={query.error} retry={query.reload} /> : <>
      {!query.data.content.length ? <PageState kind="empty" title="Không có người dùng phù hợp" description="Thử thay đổi từ khóa hoặc xóa bộ lọc." /> : <>
        <div className="hidden xl:block"><table className="w-full table-fixed bg-surface text-left"><caption className="sr-only">Người dùng, mới nhất trước</caption>
          <thead><tr className="border-b border-border"><th className="w-[28%] p-4">Người dùng</th><th className="p-4">Vai trò</th><th className="p-4">Trạng thái</th><th className="p-4">Ngày tạo</th><th className="p-4">Thao tác</th></tr></thead>
          <tbody>{query.data.content.map(user => <tr key={user.id} className="border-b border-border align-top"><td className="p-4 [overflow-wrap:anywhere]"><p className="font-bold">{user.displayName}</p><p className="mt-1 text-sm text-muted-foreground">{user.email}</p></td><td className="p-4"><Roles user={user} /></td><td className="p-4"><UserStatus user={user} /></td><td className="p-4 text-sm"><time dateTime={user.createdAt}>{date(user.createdAt)}</time></td><td className="p-4"><Actions user={user} onDone={completed} /></td></tr>)}</tbody>
        </table></div>
        <div className="grid gap-4 md:grid-cols-2 xl:hidden">{query.data.content.map(user => <article key={user.id} className={`${panel} min-w-0 space-y-3 [overflow-wrap:anywhere]`}><h2 className="text-lg font-bold">{user.displayName}</h2><p className="text-muted-foreground">{user.email}</p><Roles user={user} /><UserStatus user={user} /><p className="text-sm">Ngày tạo: {date(user.createdAt)}</p><Actions user={user} onDone={completed} /></article>)}</div>
      </>}
      <Pagination result={query.data} onPage={page} />
    </>}
  </section>;
}
function Roles({ user }: { user: AdminUser }) { return <div className="flex flex-wrap gap-2">{user.roles.map(role => <span key={role} className="rounded bg-muted px-2 py-1 text-xs font-semibold">{role}</span>)}{!user.onboardingCompleted && <span className="text-sm text-warning">Chưa hoàn tất thiết lập</span>}</div>; }
function Actions({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  return <div className="flex flex-wrap gap-2"><LinkButton href={`/admin/users/${user.id}`} variant="ghost">Xem chi tiết</LinkButton><StatusAction target={user} onDone={onDone} /></div>;
}
