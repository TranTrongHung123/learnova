"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useApiQuery } from "@/lib/api/use-query";
import { ApiError } from "@/lib/api/client";
import { Button, LinkButton } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { typeLabels, type QuestionSummary } from "@/features/question/types";
import { control, Field, message, Modal, panel, QueryState } from "./shared";
import { distributePoints, totalPoints, units } from "./points";
import { QuestionPicker } from "./question-picker";
import { versionLabel, versionPath, type ExamQuestion, type VersionDetail } from "./types";

export function VersionScreen({ examId, id, edit = false }: { examId: string; id: string; edit?: boolean }) {
  const query = useApiQuery<VersionDetail>(`/api/v1/exam-versions/${id}`), router = useRouter();
  useEffect(() => { if (edit && query.data?.status === "PUBLISHED" && query.data.examId === examId) router.replace(versionPath(examId, id)); }, [edit, query.data, router, examId, id]);
  if (!query.data) return <QueryState error={query.error} retry={query.reload} />;
  if (query.data.examId !== examId) return <PageState kind="not-found" />;
  return <VersionEditor key={`${id}:${query.data.revision}`} initial={query.data} editable={edit && query.data.status === "DRAFT"} />;
}
function VersionEditor({ initial, editable }: { initial: VersionDetail; editable: boolean }) {
  const { session } = useAuth(), router = useRouter();
  const [saved, setSaved] = useState(initial), [rows, setRows] = useState(initial.questions);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<"picker" | "publish" | "reload" | null>(null), [remote, setRemote] = useState<VersionDetail | null>(null);
  const [distribution, setDistribution] = useState("10");
  const inFlight = useRef(false);
  const dirty = JSON.stringify(rows.map(q => [q.id, q.points])) !== JSON.stringify(saved.questions.map(q => [q.id, q.points]));
  const canEdit = editable && saved.status === "DRAFT";
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const navigate = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest?.("a[href]");
      if (anchor && !window.confirm("Bản nháp còn thay đổi chưa lưu. Rời trang và bỏ các thay đổi?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  const endpoint = `/api/v1/exam-versions/${initial.id}`;
  function accept(v: VersionDetail) { setSaved(v); setRows(v.questions); setFieldErrors({}); }
  function failure(cause: unknown) {
    setError(message(cause));
    if (cause instanceof ApiError) setFieldErrors(Object.fromEntries((cause.problem?.fieldErrors ?? []).map(f => [f.field, f.message])));
  }
  function validate() {
    const errors: Record<string, string> = {};
    rows.forEach((q, i) => { try { units(q.points); } catch (cause) { errors[`questions[${i}].points`] = message(cause); } });
    setFieldErrors(errors);
    if (Object.keys(errors).length) throw new Error("Kiểm tra điểm của từng câu hỏi.");
  }
  async function save() {
    validate();
    if (!dirty) return saved;
    const result = await session.api.request<VersionDetail>(`${endpoint}/questions`, { method: "PUT", json: { revision: saved.revision, questions: rows.map(q => ({ id: q.id, points: q.points })) } });
    accept(result); return result;
  }
  async function run(action: () => Promise<void>) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (cause) { failure(cause); } finally { inFlight.current = false; setBusy(false); }
  }
  async function add(selected: QuestionSummary[]) {
    await run(async () => {
      const current = await save();
      const result = await session.api.request<VersionDetail>(`${endpoint}/questions`, { method: "POST", json: { revision: current.revision, questions: selected.map(q => ({ questionId: q.id, revision: q.revision })) } });
      accept(result); setDialog(null); setNotice("Đã thêm và lưu câu hỏi.");
    });
  }
  async function publish() {
    await run(async () => {
      const current = await save();
      try {
        const result = await session.api.request<VersionDetail>(`${endpoint}/publish`, { method: "POST", json: { revision: current.revision } });
        accept(result); setDialog(null); router.push(`/creator/exams/${initial.examId}`);
      } catch (cause) {
        if (!(cause instanceof ApiError) || cause.kind !== "http" || cause.status >= 500) {
          const confirmed = await session.api.request<VersionDetail>(endpoint);
          if (confirmed.status === "PUBLISHED") { accept(confirmed); setDialog(null); router.push(`/creator/exams/${initial.examId}`); return; }
        }
        throw cause;
      }
    });
  }
  function move(index: number, step: number) { const next = [...rows]; [next[index], next[index + step]] = [next[index + step], next[index]]; setRows(next); setNotice(""); }
  let total = "—"; try { total = totalPoints(rows.map(q => q.points)); } catch { /* Trường điểm đang nhập có thể chưa hợp lệ. */ }
  return <div className="space-y-5">
    <LinkButton variant="ghost" href={`/creator/exams/${initial.examId}`}>Quay lại lịch sử phiên bản</LinkButton>
    <section className={`${panel} space-y-3 [overflow-wrap:anywhere]`}><h2 className="text-2xl font-bold">{initial.examName}</h2><p>Phiên bản {initial.versionNumber} — {versionLabel[saved.status]}</p><p className="font-semibold tabular-nums">{rows.length} câu hỏi · Tổng điểm: {total}</p>
      <p className="text-muted-foreground">{canEdit ? "Nội dung câu hỏi là bản sao riêng của phiên bản này. Lưu bản nháp trước khi xuất bản." : "Nội dung phiên bản chỉ đọc. Tạo bản nháp mới từ lịch sử phiên bản để thay đổi."}</p>
      {initial.examStatus === "ARCHIVED" && <p>Đề đã lưu trữ: vẫn được biên soạn nhưng không dùng để tạo kỳ thi mới.</p>}
    </section>
    <p role="status" className={dirty ? "text-warning" : "text-success"}>{busy ? "Đang xử lý…" : dirty ? "Có thay đổi chưa lưu" : notice || "Đã tải nội dung được lưu trên máy chủ"}</p>
    {error && <div role="alert" className="space-y-3 text-danger"><p>{error}</p><Button variant="secondary" disabled={busy} onClick={() => void run(async () => { const current = await session.api.request<VersionDetail>(endpoint); setRemote(current); setDialog("reload"); })}>Tải bản máy chủ để đối chiếu</Button></div>}
    {canEdit && <div className={`${panel} space-y-4`}>
      <Button variant="secondary" disabled={busy} onClick={() => { setError(""); setDialog("picker"); }}>Thêm từ ngân hàng câu hỏi</Button>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); try { const points = distributePoints(distribution, rows.length); setRows(rows.map((q, i) => ({ ...q, points: points[i] }))); setFieldErrors({}); setError(""); } catch (cause) { failure(cause); } }}>
        <Field name="distribute" label="Tổng điểm muốn chia đều"><input className={control} id="distribute" inputMode="decimal" value={distribution} onChange={e => setDistribution(e.target.value)} disabled={busy} /></Field><Button variant="secondary" type="submit" disabled={busy || !rows.length}>Chia đều điểm</Button>
      </form><p className="text-sm text-muted-foreground">Phần dư được phân bổ theo thứ tự câu, chính xác tới 10 chữ số thập phân.</p>
    </div>}
    {!rows.length && <PageState kind="empty" title="Bản nháp chưa có câu hỏi" description="Thêm câu hỏi đang sử dụng từ ngân hàng của bạn." />}
    <ol className="space-y-4">{rows.map((q, i) => <li key={q.id} className={`${panel} space-y-4 [overflow-wrap:anywhere]`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Câu {i + 1} · {typeLabels[q.snapshot.type]}</h3>{canEdit && <div className="flex flex-wrap gap-2">
        <Button variant="ghost" aria-label={`Đưa câu ${i + 1} lên`} disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden size={18} />Lên</Button>
        <Button variant="ghost" aria-label={`Đưa câu ${i + 1} xuống`} disabled={busy || i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden size={18} />Xuống</Button>
        <Button variant="ghost" aria-label={`Bỏ câu ${i + 1}`} disabled={busy} onClick={() => setRows(rows.filter(row => row.id !== q.id))}><Trash2 aria-hidden size={18} />Bỏ câu</Button>
      </div>}</div>
      <SnapshotView question={q} />
      {canEdit ? <div className="max-w-xs"><Field name={`points-${q.id}`} label={`Điểm câu ${i + 1}`} error={fieldErrors[`questions[${i}].points`]}><input className={control} id={`points-${q.id}`} inputMode="decimal" value={q.points} disabled={busy} maxLength={42} aria-invalid={!!fieldErrors[`questions[${i}].points`]} aria-describedby={fieldErrors[`questions[${i}].points`] ? `points-${q.id}-error` : undefined} onChange={e => setRows(rows.map(row => row.id === q.id ? { ...row, points: e.target.value } : row))} /></Field></div> : <p className="font-semibold">{q.points} điểm</p>}
    </li>)}</ol>
    {canEdit && <div className="flex flex-wrap gap-3 pb-6"><Button variant="secondary" disabled={busy || !dirty} onClick={() => void run(async () => { await save(); setNotice("Đã lưu bản nháp."); })}>Lưu bản nháp</Button><Button disabled={busy || !rows.length} onClick={() => { setError(""); setDialog("publish"); }}>Xuất bản</Button></div>}
    {!canEdit && saved.status === "DRAFT" && <LinkButton href={versionPath(initial.examId, initial.id, true)}>Sửa bản nháp</LinkButton>}
    {dialog === "picker" && <QuestionPicker excluded={rows.map(q => q.sourceQuestionId)} add={selected => void add(selected)} close={() => setDialog(null)} busy={busy} error={error} />}
    {dialog === "publish" && <Modal title={`Xuất bản phiên bản ${initial.versionNumber}?`} close={() => setDialog(null)} busy={busy}>
      <p className="mb-4">Sau khi xuất bản, nội dung phiên bản không thể sửa. Muốn thay đổi, hãy tạo bản nháp mới. Các thay đổi hiện tại sẽ được lưu trước khi xuất bản.</p><p className="mb-4">{rows.length} câu hỏi · {total} điểm</p>{error && <p role="alert" className="mb-4 text-danger">{error}</p>}<Button disabled={busy} onClick={() => void publish()}>{busy ? "Đang xuất bản…" : "Xác nhận xuất bản"}</Button>
    </Modal>}
    {dialog === "reload" && remote && <Modal title="Đối chiếu bản máy chủ" close={() => setDialog(null)}>
      <p className="mb-4">Bản máy chủ: {versionLabel[remote.status]} · revision {remote.revision} · {remote.questions.length} câu · {remote.totalScore} điểm. Nội dung đang nhập vẫn được giữ cho tới khi bạn chọn thay thế.</p>
      <div className="mb-4 space-y-2">{remote.questions.map((q, i) => <p key={q.id}>{i + 1}. {q.snapshot.content} — {q.points} điểm</p>)}</div>
      <Button onClick={() => { accept(remote); setDialog(null); setError(""); if (remote.status === "PUBLISHED") router.replace(versionPath(remote.examId, remote.id)); }}>Thay nội dung đang nhập bằng bản máy chủ</Button>
    </Modal>}
  </div>;
}
function SnapshotView({ question: { snapshot: s } }: { question: ExamQuestion }) {
  return <div className="space-y-3"><p className="whitespace-pre-wrap text-lg">{s.content}</p>
    {s.options.length > 0 && <ol className="space-y-2">{s.options.map((o, i) => <li key={o.id} className="whitespace-pre-wrap rounded-lg bg-background p-3">{i + 1}. {o.content}{o.correct && <strong className="ml-3 text-success">Đáp án đúng</strong>}</li>)}</ol>}
    {s.type === "TRUE_FALSE" && <p>Đáp án: <strong>{s.correctBoolean ? "Đúng" : "Sai"}</strong></p>}
    {s.type === "NUMERIC_ANSWER" && <p>Đáp án số: <strong>{s.correctValue}</strong> · Sai số tuyệt đối: {s.tolerance}</p>}
    {s.explanation && <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Giải thích</summary><p className="whitespace-pre-wrap">{s.explanation}</p></details>}
    {(s.category || s.tags.length > 0) && <p className="text-sm text-muted-foreground">{s.category} · {s.tags.join(", ")}</p>}
  </div>;
}
