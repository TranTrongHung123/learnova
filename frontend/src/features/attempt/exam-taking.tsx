"use client";
import { LinkButton } from "@/components/ui/button";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageState, Skeleton } from "@/components/ui/page-state";
import { useAuth } from "@/features/auth/auth-provider";
import { Autosave } from "./autosave";
import { answered, emptyAnswer, type Answer, type Attempt, type Question, type Saved } from "./types";

const labels = { saved: "Đã lưu", dirty: "Chưa lưu", saving: "Đang lưu…", failed: "Lưu thất bại", conflict: "Cần đối chiếu" };
function answerText(q: Question, a: Answer) {
  if (a.booleanValue !== null) return a.booleanValue ? "Đúng" : "Sai";
  if (a.numericValue !== null) return a.numericValue;
  return q.options.filter(o => a.optionIds.includes(o.id)).map(o => o.content).join("; ") || "Chưa trả lời";
}
export function ExamTaking({ id }: { id: string }) {
  const { session } = useAuth(), router = useRouter();
  const engine = useMemo(() => new Autosave({
    submit: () => session.api.request<Attempt>(`/api/v1/attempts/${id}/submit`, { method: "POST", signal: AbortSignal.timeout(10000) }),
    read: () => session.api.request<Attempt>(`/api/v1/attempts/${id}`, { signal: AbortSignal.timeout(10000) }),
    save: (question, input) => session.api.request<Saved>(`/api/v1/attempts/${id}/answers/${question}`, { method: "PUT", json: input, signal: AbortSignal.timeout(10000) }),
  }), [id, session]);
  const data = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const [index, setIndex] = useState(0), [navigatorOpen, setNavigatorOpen] = useState(false);
  const leaveDialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const submitDialog = useRef<HTMLDialogElement>(null), completedHeading = useRef<HTMLHeadingElement>(null), flushTelemetry = useRef<() => void>(() => {});
  const current = data.attempt?.questions[index];
  useEffect(() => { if (data.submission === "complete") { submitDialog.current?.close(); completedHeading.current?.focus(); } }, [data.submission]);
  useEffect(() => engine.connect(), [engine]);
  useEffect(() => {
    const tick = setInterval(() => engine.tick(), 1000), sync = setInterval(() => void engine.refresh(), 30000);
    const resume = () => { void engine.refresh(); Object.keys(engine.getSnapshot().drafts).forEach(id => engine.retry(id, true)); };
    const visibility = () => { if (document.visibilityState === "visible") resume(); };
    const unload = (e: BeforeUnloadEvent) => { if (engine.hasUnsaved()) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("focus", resume); window.addEventListener("online", resume); document.addEventListener("visibilitychange", visibility); window.addEventListener("beforeunload", unload);
    return () => { clearInterval(tick); clearInterval(sync); window.removeEventListener("focus", resume); window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("beforeunload", unload); };
  }, [engine]);
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    let start = performance.now(), elapsed = 0, engaged = document.visibilityState === "visible" && document.hasFocus();
    const sample = () => { const now = performance.now(); if (engaged) elapsed += now - start; start = now; engaged = document.visibilityState === "visible" && document.hasFocus(); };
    const flush = () => { sample(); if (elapsed > 0) engine.telemetry(currentId, elapsed); elapsed = 0; };
    flushTelemetry.current = flush;
    const timer = setInterval(flush, 15000);
    window.addEventListener("focus", sample); window.addEventListener("blur", sample); document.addEventListener("visibilitychange", sample);
    return () => { flush(); flushTelemetry.current = () => {}; clearInterval(timer); window.removeEventListener("focus", sample); window.removeEventListener("blur", sample); document.removeEventListener("visibilitychange", sample); };
  }, [engine, currentId]);
  const a = data.attempt;
  if (!a) return data.error ? <PageState kind={data.errorKind ?? "error"} description={data.error} action={<Button onClick={() => void engine.refresh()}>Thử lại</Button>} /> : <Skeleton />;
  const inaccessible = data.errorKind === "forbidden" || data.errorKind === "not-found";
  const editable = engine.editable(), drafts = Object.values(data.drafts);
  const busy = ["saving", "submitting", "checking"].includes(data.submission);
  const unsaved = drafts.filter(d => d.status !== "saved").length;
  const savedAnswers = drafts.filter(d => answered(d.local.answer)).length;
  const remaining = `${Math.floor(data.remaining / 60).toString().padStart(2, "0")}:${(data.remaining % 60).toString().padStart(2, "0")}`;
  function go(next: number) { if (current) void engine.flush(current.id); setIndex(next); setNavigatorOpen(false); setTimeout(() => heading.current?.focus(), 0); }
  function leave() { router.push(`/participant/exams/${a!.sessionId}`); }
  const d = current && data.drafts[current.id];
  if (data.submission === "complete" && !inaccessible) return <section className="space-y-5 rounded-xl border border-border bg-surface p-6">
    <h1 ref={completedHeading} tabIndex={-1} className="text-2xl font-bold">{a.completionReason === "DEADLINE_REACHED" ? "Bài làm đã kết thúc do hết giờ" : "Đã nộp bài"}</h1>
    <p>{a.title} · Lượt {a.attemptNumber}</p>
    <p>Máy chủ đã hoàn tất bài làm từ các câu trả lời đã lưu.</p>
    {unsaved > 0 && <p className="text-warning">Trình duyệt chưa xác nhận lưu được một số thay đổi. Bài được chấm theo dữ liệu máy chủ đã nhận trước khi kết thúc.</p>}
    {a.submittedAt && <p>Thời điểm kết thúc: {new Date(a.submittedAt).toLocaleString("vi-VN")}</p>}
    <LinkButton variant="secondary" href={`/participant/results/${a.id}`}>Xem kết quả</LinkButton>
    <Button onClick={leave}>Về kỳ thi</Button>
  </section>;
  return <div className="space-y-5 [overflow-wrap:anywhere]">
    <header className="rounded-xl border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm text-muted-foreground">Lượt {a.attemptNumber} · Learnova</p><h1 className="text-2xl font-bold sm:text-3xl">{a.title}</h1></div>
        <div className="rounded-lg bg-muted px-4 py-2"><p className="text-sm">Thời gian còn lại</p><p aria-label={`Thời gian còn lại ${remaining}`} className={`text-2xl font-bold tabular-nums ${data.remaining <= 60 ? "text-danger" : ""}`}>{remaining}</p></div></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p role="status" aria-live="polite">{unsaved ? `${unsaved} câu có thay đổi chưa lưu` : "Tất cả thay đổi đã được lưu"}</p><Button variant="secondary" disabled={busy} onClick={() => engine.hasUnsaved() ? leaveDialog.current?.showModal() : leave()}>Về kỳ thi</Button></div>
      <p className="mt-2 text-sm text-muted-foreground">Đã trả lời {savedAnswers}/{a.questions.length || drafts.length} câu · Hạn làm bài {new Date(a.deadline).toLocaleString("vi-VN")}</p>
    </header>
    {data.error && (inaccessible ? <PageState kind={data.errorKind!} description={data.error} action={<Button onClick={() => void engine.refresh()}>Kiểm tra lại</Button>} /> : <div role="alert" className="rounded-lg border border-warning p-4"><p>{data.error}</p><Button variant="secondary" onClick={() => void engine.refresh()}>Đồng bộ lại</Button></div>)}
    {!editable && !busy && !inaccessible && <PageState kind="unavailable" title={data.submission === "unknown" ? "Chưa xác nhận trạng thái nộp bài" : "Đã hết thời gian làm bài, chờ xử lý"} description={data.submissionError ?? "Đang chờ máy chủ xác nhận kết thúc. Chỉ câu trả lời đã lưu được dùng để chấm."} action={<Button onClick={() => void engine.checkSubmission()}>Kiểm tra trạng thái</Button>} />}
    {(editable || busy) && current && d && <fieldset disabled={!editable} aria-label="Nội dung bài làm" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 space-y-5 rounded-xl border border-border bg-surface p-4 sm:p-6" aria-labelledby="question-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="question-title" ref={heading} tabIndex={-1} className="text-xl font-bold">Câu {index + 1} / {a.questions.length}</h2><span className={d.status === "failed" || d.status === "conflict" ? "text-danger" : "text-muted-foreground"}>{labels[d.status]}</span></div>
        <p id="question-content" className="whitespace-pre-wrap text-lg">{current.content}</p>
        <fieldset aria-labelledby="question-content" className="space-y-3">
          {current.options.map((o, i) => <label key={o.id} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 ${d.local.answer.optionIds.includes(o.id) ? "border-primary bg-muted" : "border-control-border"}`}>
            <input className="mt-1 size-5 shrink-0 accent-primary" type={current.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"} name={`answer-${current.id}`} checked={d.local.answer.optionIds.includes(o.id)} onChange={e => engine.edit(current.id, { answer: { ...emptyAnswer(), optionIds: current.type === "MULTIPLE_CHOICE" ? e.target.checked ? [...d.local.answer.optionIds, o.id] : d.local.answer.optionIds.filter(id => id !== o.id) : [o.id] } })} />
            <span className="whitespace-pre-wrap">{String.fromCharCode(65 + i)}. {o.content}</span></label>)}
          {current.type === "TRUE_FALSE" && [true, false].map(value => <label key={String(value)} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-control-border p-3"><input className="size-5 accent-primary" name={`answer-${current.id}`} type="radio" checked={d.local.answer.booleanValue === value} onChange={() => engine.edit(current.id, { answer: { ...emptyAnswer(), booleanValue: value } })} />{value ? "Đúng" : "Sai"}</label>)}
          {current.type === "NUMERIC_ANSWER" && <div><label htmlFor="numeric-answer" className="block font-semibold">Câu trả lời bằng số</label><input id="numeric-answer" inputMode="decimal" maxLength={42} aria-describedby="numeric-hint" className="mt-2 min-h-12 w-full rounded-lg border border-control-border bg-surface p-3 text-base" value={d.local.answer.numericValue ?? ""} onChange={e => engine.edit(current.id, { answer: { ...emptyAnswer(), numericValue: e.target.value || null } }, true)} onBlur={() => void engine.flush(current.id)} /><p id="numeric-hint" className="mt-2 text-sm text-muted-foreground">Dùng dấu chấm thập phân; tối đa 20 chữ số phần nguyên và 10 chữ số phần thập phân.</p></div>}
        </fieldset>
        <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => engine.edit(current.id, { answer: emptyAnswer() })}>Xóa câu trả lời</Button><Button variant="secondary" aria-pressed={d.local.markedForReview} onClick={() => engine.edit(current.id, { markedForReview: !d.local.markedForReview })}><Flag size={18} aria-hidden />{d.local.markedForReview ? "Bỏ đánh dấu xem lại" : "Đánh dấu xem lại"}</Button></div>
        {d.error && <div role="alert" className="space-y-2 text-danger"><p>{d.error}</p><Button variant="secondary" onClick={() => engine.retry(current.id)}>Thử lưu lại</Button></div>}
        {d.conflict && <section aria-label="Đối chiếu câu trả lời" className="space-y-3 rounded-lg border border-warning p-4"><h3 className="font-bold">Câu này đã thay đổi ở nơi khác</h3><p>Bản đang nhập: {answerText(current, d.local.answer)} · {d.local.markedForReview ? "Có" : "Không"} đánh dấu xem lại</p><p>Bản máy chủ: {answerText(current, d.conflict.answer)} · {d.conflict.markedForReview ? "Có" : "Không"} đánh dấu xem lại</p><div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => engine.resolve(current.id, false)}>Dùng bản máy chủ</Button><Button onClick={() => engine.resolve(current.id, true)}>Lưu bản đang nhập</Button></div></section>}
        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5"><Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)}>Câu trước</Button><Button disabled={index === a.questions.length - 1} onClick={() => go(index + 1)}>Câu tiếp</Button></div>
      </section>
      <aside className="space-y-4 rounded-xl border border-border bg-surface p-4"><Button variant="secondary" className="w-full lg:hidden" aria-expanded={navigatorOpen} aria-controls="question-navigator" onClick={() => setNavigatorOpen(!navigatorOpen)}>Danh sách câu hỏi</Button><div id="question-navigator" className={`${navigatorOpen ? "block" : "hidden"} space-y-4 lg:block`}><h2 className="font-bold">Điều hướng câu hỏi</h2><nav aria-label="Câu hỏi" className="grid grid-cols-4 gap-2">{a.questions.map((q, i) => { const state = data.drafts[q.id]?.local; return <button key={q.id} onClick={() => go(i)} aria-current={i === index ? "step" : undefined} aria-label={`Câu ${i + 1}, ${state && answered(state.answer) ? "đã trả lời" : "chưa trả lời"}${state?.markedForReview ? ", cần xem lại" : ""}`} className={`flex min-h-11 items-center justify-center gap-1 rounded-lg border px-1 ${i === index ? "border-primary bg-primary text-on-primary" : "border-control-border"}`}>{i + 1}{state?.markedForReview ? <Flag size={14} aria-hidden /> : state && answered(state.answer) ? <Check size={14} aria-hidden /> : null}</button>; })}</nav><p className="text-sm text-muted-foreground">✓ Đã trả lời · Cờ: cần xem lại. Trạng thái lưu hiển thị riêng ở từng câu.</p></div><Button className="w-full" onClick={() => submitDialog.current?.showModal()}>Nộp bài</Button></aside>
    </fieldset>}
    <dialog ref={submitDialog} aria-labelledby="submit-title" onCancel={e => { if (busy) e.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-xl border border-border bg-surface p-6 text-foreground backdrop:bg-scrim">
      <h2 id="submit-title" className="text-xl font-bold">Nộp bài thi?</h2>
      <div className="my-4 space-y-2"><p>Đã trả lời: {savedAnswers}</p><p>Chưa trả lời: {drafts.length - savedAnswers}</p><p>Đánh dấu xem lại: {drafts.filter(d => d.local.markedForReview).length}</p><p>Sau khi nộp, bạn không thể sửa câu trả lời.</p></div>
      {busy && <p role="status" className="my-3">{data.submission === "saving" ? "Đang lưu các thay đổi…" : data.submission === "submitting" ? "Đang nộp bài…" : "Đang kiểm tra trạng thái…"}</p>}
      {data.submissionError && <p role="alert" className="my-3 text-danger">{data.submissionError}</p>}
      <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={busy} onClick={() => submitDialog.current?.close()}>Tiếp tục làm bài</Button>
        {data.submission === "unknown" ? <Button onClick={() => void engine.checkSubmission()}>Kiểm tra trạng thái</Button> : <Button disabled={busy || !editable} onClick={() => { flushTelemetry.current(); void engine.submit(); }}>Xác nhận nộp bài</Button>}</div>
    </dialog>
    <dialog ref={leaveDialog} aria-labelledby="leave-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface p-6 text-foreground backdrop:bg-scrim"><h2 id="leave-title" className="text-xl font-bold">Còn thay đổi chưa lưu</h2><p className="my-4">Rời trang có thể làm mất phần chưa được máy chủ xác nhận.</p><div className="flex flex-wrap gap-3"><Button onClick={() => leaveDialog.current?.close()}>Tiếp tục làm bài</Button><Button variant="secondary" onClick={leave}>Rời trang</Button></div></dialog>
  </div>;
}
