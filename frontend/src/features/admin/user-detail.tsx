"use client";

import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { useApiQuery } from "@/lib/api/use-query";
import { ConfirmMutation, date, panel, QueryState, StatusAction, usersApi, UserStatus } from "./shared";
import { businessRoles, type AdminUser, type BusinessRole } from "./types";

export function UserDetail({ id }: { id: string }) {
  const query = useApiQuery<AdminUser>(`${usersApi}/${id}`);
  const [notice, setNotice] = useState("");
  function completed() { setNotice("Đã cập nhật tài khoản và ghi nhật ký."); query.reload(); }
  const target = query.data;
  return <section className="space-y-6" aria-label="Chi tiết người dùng">
    <div className="flex flex-wrap gap-3"><LinkButton variant="ghost" href="/admin/users">Về danh sách người dùng</LinkButton><Button variant="secondary" onClick={query.reload}>Làm mới</Button></div>
    {notice && <p role="status" className="text-success">{notice}</p>}
    {!target ? <QueryState error={query.error} retry={query.reload} /> : <>
      <div className={`${panel} space-y-4 [overflow-wrap:anywhere]`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{target.displayName}</h2><UserStatus user={target} /></div>
        <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Email</dt><dd>{target.email}</dd></div><div><dt className="text-sm text-muted-foreground">Mã người dùng</dt><dd className="font-mono text-sm">{target.id}</dd></div><div><dt className="text-sm text-muted-foreground">Ngày tạo</dt><dd>{date(target.createdAt)}</dd></div><div><dt className="text-sm text-muted-foreground">Thiết lập tài khoản</dt><dd>{target.onboardingCompleted ? "Đã hoàn tất" : "Chưa hoàn tất"}</dd></div></dl>
      </div>
      <RolesEditor key={target.roles.join(",")} target={target} onDone={completed} />
      <div className={`${panel} space-y-4`}><h2 className="text-xl font-bold">Trạng thái và bảo mật</h2><p className="text-muted-foreground">Khóa tài khoản giữ nguyên lịch sử. Sau khi mở khóa, người dùng cần đăng nhập lại.</p>
        <StatusAction target={target} onDone={completed} />
        {target.status === "DISABLED" && <p>Tài khoản đã ngừng hoạt động; không thể khóa hoặc mở khóa tại đây.</p>}
      </div>
      <div className="flex flex-wrap gap-3"><LinkButton variant="secondary" href={`/admin/audit-logs?targetType=User&targetId=${id}`}>Nhật ký thay đổi tài khoản</LinkButton><LinkButton variant="ghost" href={`/admin/audit-logs?actorUserId=${id}`}>Hoạt động của người dùng</LinkButton></div>
    </>}
  </section>;
}
function RolesEditor({ target, onDone }: { target: AdminUser; onDone: () => void }) {
  const { session } = useAuth();
  const [roles, setRoles] = useState<BusinessRole[]>(businessRoles.filter(role => target.roles.includes(role)));
  const [confirm, setConfirm] = useState(false);
  const hasAdmin = target.roles.includes("ADMIN");
  const changed = businessRoles.some(role => roles.includes(role) !== target.roles.includes(role));
  const invalid = !hasAdmin && roles.length === 0;
  return <div className={`${panel} space-y-4`}><h2 className="text-xl font-bold">Vai trò</h2>
    {hasAdmin && <p className="text-sm font-semibold text-primary">ADMIN · Được giữ nguyên</p>}
    <p className="text-muted-foreground">Quản lý quyền tham gia và tạo kỳ thi. Quyền ADMIN được cấp qua quy trình vận hành riêng.</p>
    <fieldset disabled={!target.onboardingCompleted} aria-describedby="role-help" className="space-y-2"><legend className="sr-only">Vai trò nghiệp vụ</legend>
      {businessRoles.map(role => <label key={role} className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5 accent-primary" checked={roles.includes(role)} onChange={event => setRoles(previous => event.target.checked ? [...previous, role] : previous.filter(value => value !== role))} />{role}</label>)}
    </fieldset>
    <p id="role-help" className={`text-sm ${invalid ? "text-danger" : "text-muted-foreground"}`}>{!target.onboardingCompleted ? "Người dùng cần hoàn tất thiết lập tài khoản trước khi sửa vai trò." : invalid ? "Chọn ít nhất một vai trò cho tài khoản này." : "Thay đổi áp dụng theo quyền backend; access token cũ có thể còn hiệu lực tối đa 15 phút."}</p>
    <Button disabled={!changed || invalid || !target.onboardingCompleted} onClick={() => setConfirm(true)}>Lưu vai trò</Button>
    {confirm && <ConfirmMutation title="Xác nhận thay đổi vai trò" confirmLabel="Xác nhận lưu vai trò" onClose={() => setConfirm(false)} onDone={onDone}
      action={() => session.api.request(`${usersApi}/${target.id}/roles`, { method: "PUT", json: { roles } })}>
      <p className="[overflow-wrap:anywhere]">Tài khoản: {target.email}</p><p>Vai trò sau thay đổi: {[...(hasAdmin ? ["ADMIN"] : []), ...roles].join(", ")}</p><p>Bài làm, kết quả và nội dung đã tạo được giữ nguyên. Thao tác được ghi vào nhật ký.</p>
    </ConfirmMutation>}
  </div>;
}
