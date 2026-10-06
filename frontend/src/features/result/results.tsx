"use client";

import { useState } from "react";
import { ExportButton } from "@/features/reporting/export-button";
import { useApiQuery } from "@/lib/api/use-query";
import { useAuth } from "@/features/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { Pagination } from "@/features/classroom/shared";
import { QueryState, panel, date, Modal, message } from "@/features/session/shared";
import { availabilityLabels, type Score, type History, type ResultDetail, type PageResult, type SessionResults } from "./types";

function ScoreValue({ value }: { value: Score }) {
  return <p className="text-lg font-bold">{value.score} / {value.totalScore} điểm · <span className={value.passed ? "text-success" : "text-danger"}>{value.passed ? "Đạt" : "Chưa đạt"}</span></p>;
}
export function ResultHistory() {
  const [page, setPage] = useState(0);
  const query = useApiQuery<PageResult<History>>(`/api/v1/participant/results?page=${page}`, true);
  return <section className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><p>Điểm cao nhất trong các lượt đã chấm của từng kỳ thi.</p><Button variant="secondary" onClick={query.reload}>Làm mới</Button></div>
    {!query.data ? <QueryState error={query.error} retry={query.reload} /> : <>
      {!query.data.content.length && <PageState kind="empty" title="Chưa có lịch sử bài làm" action={<LinkButton href="/participant/exams">Xem kỳ thi của tôi</LinkButton>} />}
      {query.data.content.map(h => <article key={h.sessionId} className={`${panel} space-y-3 [overflow-wrap:anywhere]`}>
        <h2 className="text-xl font-bold">{h.title}</h2><p>Đề: {h.examName} · {h.attemptCount} lượt</p>
        {h.completedAt && <p>Hoàn tất gần nhất: {date(h.completedAt)}</p>}<p>{availabilityLabels[h.availability]}</p>
        {h.bestResult && <ScoreValue value={h.bestResult} />}
        <div className="flex flex-wrap gap-3">{h.bestAttemptId && <LinkButton href={`/participant/results/${h.bestAttemptId}`}>Xem lượt điểm cao nhất</LinkButton>}
          <LinkButton variant="secondary" href={`/participant/exams/${h.sessionId}`}>Xem kỳ thi và mọi lượt làm</LinkButton></div>
      </article>)}<Pagination result={query.data} onPage={setPage} />
    </>}
  </section>;
}
function ResultContent({ value: r }: { value: ResultDetail }) {
  return <div className="space-y-5"><section className={`${panel} space-y-3`}>
    <h2 className="text-xl font-bold">{r.title} · Lượt {r.attemptNumber}</h2>{r.submittedAt && <p>Nộp bài: {date(r.submittedAt)}</p>}
    <p role="status">{availabilityLabels[r.availability]}</p>{r.result && <ScoreValue value={r.result} />}
    {r.summary && <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[["Đúng", r.summary.correctCount], ["Sai", r.summary.incorrectCount], ["Chưa trả lời", r.summary.unansweredCount], ["Thời gian (giây)", r.summary.durationSeconds]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="text-xl font-bold">{value}</dd></div>)}</dl>}
  </section>
    {r.questions?.map((q, index) => <article key={q.id} className={`${panel} space-y-3 whitespace-pre-wrap [overflow-wrap:anywhere]`}>
      <h3 className="text-lg font-bold">Câu {index + 1} · {q.awardedScore} / {q.points} điểm · {q.correct ? "Đúng" : "Không đạt điểm"}</h3><p>{q.content}</p>
      {q.options.length > 0 ? <ul className="space-y-2">{q.options.map(o => <li key={o.id} className="rounded-lg border border-border p-3">{o.content}{q.answer.optionIds.includes(o.id) && <strong> · Bạn đã chọn</strong>}{o.correct && <strong className="text-success"> · Đáp án đúng</strong>}</li>)}</ul> : <>
        <p>Câu trả lời của bạn: {q.answer.booleanValue != null ? (q.answer.booleanValue ? "Đúng" : "Sai") : q.answer.numericValue ?? "Chưa trả lời"}</p>
        <p>Đáp án đúng: {q.correctBoolean != null ? (q.correctBoolean ? "Đúng" : "Sai") : q.correctValue}{q.type === "NUMERIC_ANSWER" && q.tolerance != null && ` · Sai số tuyệt đối: ${q.tolerance}`}</p>
      </>}
      {q.options.length > 0 && q.answer.optionIds.length === 0 && <p>Bạn chưa trả lời câu này.</p>}
      {q.explanation && <div><h4 className="font-bold">Giải thích</h4><p>{q.explanation}</p></div>}
    </article>)}
  </div>;
}
export function ResultScreen({ id, sessionId }: { id: string; sessionId?: string }) {
  const query = useApiQuery<ResultDetail>(sessionId ? `/api/v1/exam-sessions/${sessionId}/attempts/${id}/result` : `/api/v1/participant/results/${id}`, true);
  return <div className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><LinkButton variant="secondary" href={sessionId ? `/creator/sessions/${sessionId}/results` : "/participant/results"}>Về danh sách kết quả</LinkButton><Button variant="secondary" onClick={query.reload}>Làm mới</Button></div>
    {!query.data ? <QueryState error={query.error} retry={query.reload} /> : <ResultContent value={query.data} />}
  </div>;
}
export function ResultAttempts({ sessionId, participantId }: { sessionId: string; participantId?: string }) {
  const [page, setPage] = useState(0);
  const query = useApiQuery<PageResult<ResultDetail>>(participantId ? `/api/v1/exam-sessions/${sessionId}/results/${participantId}/attempts?page=${page}` : `/api/v1/participant/exam-sessions/${sessionId}/results?page=${page}`, true);
  return <section className="space-y-3" aria-label="Các lượt làm bài"><h3 className="font-bold">Tất cả lượt làm</h3>
    {!query.data ? <QueryState error={query.error} retry={query.reload} /> : <>
      {!query.data.content.length && <p>Chưa có lượt làm.</p>}{query.data.content.map(a => <article key={a.id} className="space-y-2 rounded-lg border border-border p-4">
        <h4 className="font-bold">Lượt {a.attemptNumber} · {a.status === "IN_PROGRESS" ? "Đang làm" : "Đã hoàn tất"}</h4><p>{availabilityLabels[a.availability]}</p>
        {a.result && <ScoreValue value={a.result} />}{a.submittedAt && <p>Nộp bài: {date(a.submittedAt)}</p>}
        {a.summary && <p>Thời gian: {a.summary.durationSeconds} giây</p>}
        {a.availability === "AVAILABLE" && <LinkButton variant="secondary" href={participantId ? `/creator/sessions/${sessionId}/results/${a.id}` : `/participant/results/${a.id}`}>Xem kết quả lượt {a.attemptNumber}</LinkButton>}
      </article>)}<Pagination result={query.data} onPage={setPage} />
    </>}
  </section>;
}
export function CreatorResults({ id }: { id: string }) {
  const [page, setPage] = useState(0), [selected, setSelected] = useState<string>(), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const { session } = useAuth();
  const query = useApiQuery<SessionResults>(`/api/v1/exam-sessions/${id}/results?page=${page}`, true);
  async function release() {
    setBusy(true); setError("");
    try { await session.api.request(`/api/v1/exam-sessions/${id}/release-results`, { method: "POST" }); setConfirm(false); query.reload(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  const s = query.data;
  return <div className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><LinkButton variant="secondary" href={`/creator/sessions/${id}`}>Về kỳ thi</LinkButton><Button variant="secondary" onClick={query.reload}>Làm mới</Button></div>
    {!s ? <QueryState error={query.error} retry={query.reload} /> : <>
      <h2 className="text-2xl font-bold">{s.title}</h2><p>Điểm cao nhất được tính từ toàn bộ lượt đã chấm. Quyền xem của người tham gia vẫn tuân theo chính sách kỳ thi.</p>
      <div className="flex flex-wrap gap-4"><LinkButton variant="secondary" href={`/creator/sessions/${id}/analytics`}>Xem thống kê</LinkButton><ExportButton id={id} /></div>
      {s.releasedAt && <p role="status">Đã công bố thủ công: {date(s.releasedAt)}</p>}{s.canRelease && <Button onClick={() => { setConfirm(true); setError(""); }}>Công bố kết quả</Button>}
      {!s.participants.content.length && <PageState kind="empty" title="Chưa có người tham gia làm bài" />}
      {s.participants.content.map(h => <article key={h.participantId} className={`${panel} space-y-3`}><h3 className="text-lg font-bold">{h.participantName}</h3><p>{h.attemptCount} lượt làm</p>
        {h.bestResult ? <ScoreValue value={h.bestResult} /> : <p>Chưa có kết quả đã chấm.</p>}{h.completedAt && <p>Hoàn tất gần nhất: {date(h.completedAt)}</p>}
        <Button variant="secondary" aria-expanded={selected === h.participantId} onClick={() => setSelected(selected === h.participantId ? undefined : h.participantId)}>Xem các lượt làm</Button>
        {selected === h.participantId && <ResultAttempts key={h.participantId} sessionId={id} participantId={h.participantId} />}
      </article>)}<Pagination result={s.participants} onPage={p => { setPage(p); setSelected(undefined); }} />
    </>}
    {confirm && <Modal title="Công bố kết quả kỳ thi?" busy={busy} close={() => setConfirm(false)}><p className="mb-4">Người tham gia sẽ xem được các kết quả đã chấm theo chế độ hiển thị của kỳ thi, kể cả lượt hoàn tất sau đó. Chế độ HIDDEN vẫn ẩn kết quả. Không thể thu hồi công bố.</p>
      {error && <p role="alert" className="mb-4 text-danger">{error}</p>}<Button disabled={busy} onClick={() => void release()}>{busy ? "Đang công bố…" : "Xác nhận công bố"}</Button>
    </Modal>}
  </div>;
}
