"use client";

import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageState } from "@/components/ui/page-state";
import { apiRoot, classroomMessage, Confirm, control, date, ErrorText, Modal, Pagination, panel, QueryState, useClassroomQuery } from "./shared";
import type { Member, PageResult, Participant } from "./types";

function AddParticipant({ classId, onClose, onAdded }: { classId: string; onClose: () => void; onAdded: () => void }) {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<Participant>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function lookup() {
    setBusy(true); setError(""); setFound(undefined);
    try { setFound(await session.api.request<Participant>(`${apiRoot}/${classId}/participants/lookup?email=${encodeURIComponent(email.trim())}`)); }
    catch (cause) { setError(classroomMessage(cause)); } finally { setBusy(false); }
  }
  async function add() {
    if (!found) return;
    setBusy(true); setError("");
    try { await session.api.request(`${apiRoot}/${classId}/members`, { method: "POST", json: { userId: found.userId } }); onAdded(); onClose(); }
    catch (cause) { setError(classroomMessage(cause)); } finally { setBusy(false); }
  }
  return <Modal title="Thêm Participant" onClose={onClose} busy={busy}><div className="space-y-4">
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void lookup(); }}>
      <Input id="participant-email" label="Email đầy đủ" type="email" required maxLength={254} disabled={busy} value={email} onChange={(e) => { setEmail(e.target.value); setFound(undefined); setError(""); }} />
      <Button variant="secondary" type="submit" disabled={busy}>{busy ? "Đang xử lý…" : "Tìm Participant"}</Button></form>
    <ErrorText message={error} />
    {found && <div className="space-y-3 rounded-lg bg-muted p-4"><p className="font-semibold [overflow-wrap:anywhere]">{found.displayName}</p><p className="[overflow-wrap:anywhere]">{found.email}</p>
      <Button disabled={busy} onClick={() => void add()}>Thêm vào lớp</Button></div>}
  </div></Modal>;
}
export function ClassroomMembers({ classId, onChanged }: { classId: string; onChanged: () => void }) {
  const { session } = useAuth();
  const [page, setPage] = useState(0);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Member>();
  const [notice, setNotice] = useState("");
  const query = useClassroomQuery<PageResult<Member>>(`${apiRoot}/${classId}/members?page=${page}&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`);
  function changed(message: string, removed = false) {
    setNotice(message);
    if (removed && status === "ACTIVE" && page > 0 && query.data?.content.length === 1) setPage(page - 1);
    else query.reload();
    onChanged();
  }
  return <section className="space-y-5" aria-label="Danh sách thành viên">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Thành viên</h2><Button onClick={() => setAdding(true)}>Thêm Participant</Button></div>
    {notice && <p role="status" className="text-success">{notice}</p>}
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setSearch(input.trim()); setPage(0); }}>
      <div className="min-w-0 flex-1"><Input id="member-search" label="Tìm tên hoặc email thành viên" maxLength={254} value={input} onChange={(e) => setInput(e.target.value)} /></div>
      <div><label htmlFor="member-status" className="mb-2 block text-sm font-semibold">Trạng thái</label><select id="member-status" className={control} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="ACTIVE">Đang tham gia</option><option value="REMOVED">Đã rời / bị xóa</option><option value="">Tất cả</option></select></div>
      <Button type="submit" variant="secondary">Tìm kiếm</Button>
    </form>
    {!query.data ? <QueryState error={query.error} retry={query.reload} /> : <>
      {!query.data.content.length ? <PageState kind="empty" title="Chưa có thành viên phù hợp" description="Thêm Participant hoặc thay đổi bộ lọc để xem thành viên." /> :
        <ul className="space-y-3">{query.data.content.map((member) => <li key={member.id} className={`${panel} flex flex-wrap items-center justify-between gap-4`}>
          <div className="min-w-0 flex-1 space-y-1 [overflow-wrap:anywhere]"><h3 className="font-semibold">{member.displayName}</h3><p>{member.email}</p>
            <p className="text-sm text-muted-foreground">Tham gia lần đầu {date(member.joinedAt)}</p><p className="text-sm">{member.status === "ACTIVE" ? "Đang tham gia" : "Đã rời / bị xóa"}</p></div>
          {member.status === "ACTIVE" && <Button variant="secondary" onClick={() => setRemoving(member)}>Xóa khỏi lớp<span className="sr-only"> {member.email}</span></Button>}
        </li>)}</ul>}
      <Pagination result={query.data} onPage={setPage} />
    </>}
    {adding && <AddParticipant classId={classId} onClose={() => setAdding(false)} onAdded={() => changed("Đã thêm Participant vào lớp.")} />}
    {removing && <Confirm title="Xóa Participant khỏi lớp?" description={`${removing.displayName} sẽ mất quyền bắt đầu bài làm mới qua lớp. Bài đang làm vẫn được hoàn tất; lịch sử bài làm và kết quả được giữ nguyên.`}
      confirmLabel="Xác nhận xóa" action={() => session.api.request(`${apiRoot}/${classId}/members/${removing.userId}`, { method: "DELETE" })}
      onClose={() => setRemoving(undefined)} onDone={() => changed("Đã xóa Participant khỏi lớp.", true)} />}
  </section>;
}
