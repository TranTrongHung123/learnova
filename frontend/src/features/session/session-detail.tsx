"use client";
import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { useApiQuery } from "@/lib/api/use-query";
import { Button, LinkButton } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { apiRoot, path, statusLabels, accessLabels, displayLabels, releaseLabels, localDate, type SessionDetail } from "./types";
import { Modal, panel, control, QueryState, message, date } from "./shared";

export function SessionSummary({ s }: { s: SessionDetail }) {
  return <div className="grid gap-4 md:grid-cols-2">
    <section className={`${panel} space-y-2`}><h3 className="text-lg font-bold">Lịch thi</h3><p>Bắt đầu: {date(s.startTime)}</p><p>Kết thúc: {date(s.endTime)}</p><p>{s.durationMinutes} phút · Tối đa {s.maxAttempts} lượt</p><p>Điểm đạt: {s.passingScore} / {s.totalScore}</p></section>
    <section className={`${panel} space-y-2`}><h3 className="text-lg font-bold">Đối tượng</h3><p>{accessLabels[s.accessType]}</p>{s.accessType === "PUBLIC" ? <p>Yêu cầu đăng nhập và vai trò PARTICIPANT.</p> : <ul className="list-inside list-disc">{[...s.classrooms, ...s.participants].map(t => <li key={t.id}>{t.name}</li>)}</ul>}{s.accessType === "CLASS" && <p>Quyền tham gia theo thành viên ACTIVE hiện tại của các lớp.</p>}</section>
    <section className={`${panel} space-y-2`}><h3 className="text-lg font-bold">Cấu hình</h3><p>{s.examName} · Phiên bản {s.versionNumber} · {s.questionCount} câu</p><p>Trộn câu hỏi: {s.shuffleQuestions ? "Có" : "Không"}</p><p>Trộn đáp án: {s.shuffleAnswers ? "Có" : "Không"}</p></section>
    <section className={`${panel} space-y-2`}><h3 className="text-lg font-bold">Chính sách kết quả</h3><p>{displayLabels[s.resultDisplayMode]}</p><p>{releaseLabels[s.resultReleasePolicy]}</p></section>
  </div>;
}
export function SessionScreen({ id }: { id: string }) {
  const query = useApiQuery<SessionDetail>(`${apiRoot}/${id}`), { session } = useAuth();
  const [command, setCommand] = useState<"schedule" | "cancel" | "extend-end-time">();
  const [current, setCurrent] = useState<SessionDetail>();
  const [endTime, setEndTime] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  if (!query.data) return <QueryState error={query.error} retry={query.reload} />;
  const s = current ?? query.data;
  async function execute() {
    setBusy(true); setError(""); setFieldError("");
    try {
      const saved = await session.api.request<SessionDetail>(`${apiRoot}/${id}/${command}`, { method: "POST", json: { revision: s.revision, ...(command === "extend-end-time" ? { newEndTime: new Date(endTime).toISOString() } : {}) } });
      setCurrent(saved); setCommand(undefined);
    } catch (cause) {
      setError(message(cause));
      if (cause instanceof ApiError) {
        setFieldError(cause.problem?.fieldErrors.find(f => f.field === "newEndTime")?.message ?? "");
        if (cause.status === 409) try { setCurrent(await session.api.request<SessionDetail>(`${apiRoot}/${id}`)); } catch { /* Giữ lỗi gốc và dữ liệu nhập để đối chiếu. */ }
      }
    } finally { setBusy(false); }
  }
  return <div className="space-y-6"><LinkButton variant="ghost" href="/creator/sessions">Danh sách kỳ thi</LinkButton>
    <header className="space-y-2"><h2 className="text-2xl font-bold [overflow-wrap:anywhere]">{s.title}</h2><p>{statusLabels[s.status]}</p></header>
    {!s.actions.editConfiguration && s.actions.editTitle && <p className="rounded-lg bg-muted p-4">Cấu hình đã khóa vì kỳ thi đã mở hoặc đã có bài làm. Chỉ có thể sửa tên và gia hạn khi được phép.</p>}
    <div className="flex flex-wrap gap-3">{s.actions.editTitle && <LinkButton variant="secondary" href={`${path(id)}/edit`}>Chỉnh sửa</LinkButton>}
      <LinkButton variant="secondary" href={`${path(id)}/monitor`}>Giám sát kỳ thi</LinkButton>
      <LinkButton variant="secondary" href={`${path(id)}/analytics`}>Thống kê kỳ thi</LinkButton>
      {s.actions.schedule && <Button onClick={() => { setCommand("schedule"); setError(""); }}>Lên lịch</Button>}
      {s.actions.extend && <Button variant="secondary" onClick={() => { setEndTime(localDate(s.endTime)); setError(""); setFieldError(""); setCommand("extend-end-time"); }}>Gia hạn</Button>}
      {s.actions.cancel && <Button variant="secondary" onClick={() => { setCommand("cancel"); setError(""); }}>Hủy kỳ thi</Button>}
      <Button variant="ghost" onClick={async () => { try { setCurrent(await session.api.request<SessionDetail>(`${apiRoot}/${id}`)); setError(""); } catch (e) { setError(message(e)); } }}>Tải lại trạng thái</Button>
    </div><SessionSummary s={s} />
    <section className={`${panel} space-y-2`}><h3 className="text-lg font-bold">Bài làm và kết quả</h3><LinkButton variant="secondary" href={`/creator/sessions/${id}/results`}>Xem kết quả và công bố</LinkButton></section>
    {error && !command && <p role="alert" className="text-danger">{error}</p>}
    {command && <Modal title={command === "cancel" ? "Hủy kỳ thi?" : command === "schedule" ? "Lên lịch kỳ thi?" : "Gia hạn giờ kết thúc"} close={() => setCommand(undefined)} busy={busy}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void execute(); }}>
        {command === "cancel" ? <p>Kỳ thi sẽ không còn khả dụng. Thao tác được ghi nhật ký và không thể hoàn tác.</p> : command === "schedule" ? <p>Kỳ thi mở theo giờ máy chủ. Nếu giờ bắt đầu đã tới, kỳ thi sẽ mở ngay và khóa cấu hình.</p> : <>
          <p>Hiện tại: {date(s.endTime)}</p><p>Gia hạn không đổi deadline bài làm đã bắt đầu, không mở lại bài đã hoàn tất. Lượt mới và công bố kết quả sau kỳ thi dùng giờ kết thúc mới.</p>
          <label htmlFor="newEndTime" className="block">Giờ kết thúc mới ({Intl.DateTimeFormat().resolvedOptions().timeZone})</label>
          <input id="newEndTime" type="datetime-local" className={control} required value={endTime} onChange={e => setEndTime(e.target.value)} aria-invalid={!!fieldError} aria-describedby={fieldError ? "newEndTime-error" : undefined} />
          {fieldError && <p id="newEndTime-error" className="text-danger">{fieldError}</p>}
        </>}
        {error && <p role="alert" className="text-danger">{error}</p>}
        <Button type="submit" disabled={busy || (command === "cancel" && !s.actions.cancel) || (command === "schedule" && !s.actions.schedule) || (command === "extend-end-time" && !s.actions.extend)}>{busy ? "Đang xử lý…" : "Xác nhận"}</Button>
      </form>
    </Modal>}
  </div>;
}
