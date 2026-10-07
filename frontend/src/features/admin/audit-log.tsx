"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { useApiQuery } from "@/lib/api/use-query";
import { control, date, Field, Pagination, panel, QueryState } from "./shared";
import { auditActions, type AuditItem, type AuditPage } from "./types";

function localTime(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AuditLog() {
  const params = useSearchParams(), router = useRouter();
  const query = useApiQuery<AuditPage>(`/api/v1/admin/audit-logs?${params}`);
  const [validation, setValidation] = useState("");
  function page(value: number) { const next = new URLSearchParams(params); next.set("page", String(value)); router.push(`/admin/audit-logs?${next}`); }
  return <section aria-label="Nhật ký hoạt động" className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-muted-foreground">Tra cứu ai đã thay đổi dữ liệu, đối tượng chịu tác động và thời điểm thực hiện. Nhật ký chỉ đọc, mới nhất trước.</p><Button variant="secondary" onClick={query.reload}>Làm mới</Button></div>
    <form key={params.toString()} className={`${panel} grid gap-4 sm:grid-cols-2 xl:grid-cols-3`} onSubmit={event => {
      event.preventDefault(); const next = new URLSearchParams();
      new FormData(event.currentTarget).forEach((value, key) => { const text = String(value).trim(); if (text) next.set(key, key === "from" || key === "to" ? new Date(text).toISOString() : text); });
      if (next.has("from") && next.has("to") && next.get("from")! >= next.get("to")!) { setValidation("Thời điểm đến phải sau thời điểm từ."); event.currentTarget.querySelector<HTMLInputElement>("#to")?.focus(); return; }
      setValidation(""); router.push(`/admin/audit-logs?${next}`);
    }}>
      <Field id="action" label="Hành động"><select className={control} id="action" name="action" defaultValue={params.get("action") ?? ""}><option value="">Tất cả hành động</option>{auditActions.map(action => <option key={action}>{action}</option>)}</select></Field>
      <Field id="actorUserId" label="Mã người thực hiện"><input className={control} id="actorUserId" name="actorUserId" maxLength={128} defaultValue={params.get("actorUserId") ?? ""} /></Field>
      <Field id="targetType" label="Loại đối tượng"><select className={control} id="targetType" name="targetType" defaultValue={params.get("targetType") ?? ""}><option value="">Tất cả đối tượng</option>{["User", "Classroom", "QUESTION", "QUESTION_IMPORT", "EXAM", "EXAM_VERSION", "EXAM_SESSION"].map(type => <option key={type}>{type}</option>)}</select></Field>
      <Field id="targetId" label="Mã đối tượng"><input className={control} id="targetId" name="targetId" maxLength={128} defaultValue={params.get("targetId") ?? ""} /></Field>
      <Field id="from" label="Từ thời điểm"><input className={`${control} min-w-0`} type="datetime-local" id="from" name="from" defaultValue={localTime(params.get("from"))} aria-describedby="time-help" /></Field>
      <Field id="to" label="Đến trước thời điểm"><input className={`${control} min-w-0`} type="datetime-local" id="to" name="to" defaultValue={localTime(params.get("to"))} aria-invalid={!!validation} aria-describedby={validation ? "time-error time-help" : "time-help"} onChange={() => setValidation("")} /></Field>
      <p id="time-help" className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">Thời gian theo múi giờ của trình duyệt; bộ lọc gồm mốc từ và không gồm mốc đến.</p>
      {validation && <p id="time-error" role="alert" className="text-danger sm:col-span-2 xl:col-span-3">{validation}</p>}
      <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-3"><Button type="submit">Lọc nhật ký</Button><LinkButton variant="ghost" href="/admin/audit-logs">Xóa bộ lọc</LinkButton></div>
    </form>
    {!query.data ? <QueryState error={query.error} retry={query.reload} /> : <>
      {!query.data.content.length ? <PageState kind="empty" title="Không có nhật ký phù hợp" description="Thử mở rộng thời gian hoặc thay đổi bộ lọc." /> : <>
        <div className="hidden xl:block"><table className="w-full table-fixed bg-surface text-left"><caption className="sr-only">Nhật ký hoạt động, mới nhất trước</caption><thead><tr className="border-b border-border"><th className="w-[17%] p-4">Thời điểm</th><th className="p-4">Người thực hiện</th><th className="w-[24%] p-4">Hành động</th><th className="p-4">Đối tượng</th><th className="p-4">Thay đổi</th></tr></thead>
          <tbody>{query.data.content.map(item => <tr key={item.id} className="border-b border-border align-top text-sm [overflow-wrap:anywhere]"><td className="p-4"><time dateTime={item.occurredAt}>{date(item.occurredAt)}</time></td><td className="p-4"><Actor item={item} /></td><td className="p-4 font-semibold">{item.action}</td><td className="p-4"><Target item={item} /></td><td className="p-4"><Metadata item={item} /></td></tr>)}</tbody>
        </table></div>
        <div className="space-y-4 xl:hidden">{query.data.content.map(item => <article key={item.id} className={`${panel} space-y-3 [overflow-wrap:anywhere]`}><h2 className="font-bold">{item.action}</h2><p className="text-sm text-muted-foreground"><time dateTime={item.occurredAt}>{date(item.occurredAt)}</time></p><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Người thực hiện</dt><dd><Actor item={item} /></dd></div><div><dt className="text-sm text-muted-foreground">Đối tượng</dt><dd><Target item={item} /></dd></div></dl><Metadata item={item} /></article>)}</div>
      </>}
      <Pagination result={query.data} onPage={page} />
    </>}
  </section>;
}
function UserLink({ id }: { id: string }) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? <Link className="inline-flex min-h-11 items-center text-primary underline [overflow-wrap:anywhere]" href={`/admin/users/${id}`}>{id}</Link> : <span>{id}</span>;
}
function Actor({ item }: { item: AuditItem }) { return item.actorUserId ? <UserLink id={item.actorUserId} /> : <span>Hệ thống</span>; }
function Target({ item }: { item: AuditItem }) { return <div><p className="font-semibold">{item.targetType}</p>{item.targetType === "User" ? <UserLink id={item.targetId} /> : <p>{item.targetId}</p>}</div>; }
const metadataLabels: Record<string, string> = { oldRoles: "Vai trò trước", newRoles: "Vai trò sau", oldStatus: "Trạng thái trước", newStatus: "Trạng thái sau", oldEndTime: "Kết thúc trước", newEndTime: "Kết thúc sau", version: "Phiên bản", status: "Trạng thái", revision: "Revision", importedRows: "Dòng đã import", skippedRows: "Dòng bỏ qua", userId: "Mã người dùng", membershipId: "Mã thành viên" };
function Metadata({ item }: { item: AuditItem }) {
  const entries = Object.entries(item.metadata);
  if (!entries.length) return <p className="text-sm text-muted-foreground">Không có thay đổi chi tiết.</p>;
  return <details><summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Xem thay đổi</summary><dl className="space-y-2 text-sm">{entries.map(([key, value]) => <div key={key}><dt className="text-muted-foreground">{metadataLabels[key] ?? key}</dt><dd className="[overflow-wrap:anywhere]">{value || "—"}</dd></div>)}</dl></details>;
}
