"use client";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useApiQuery } from "@/lib/api/use-query";
import { ApiError } from "@/lib/api/client";
import { Button, LinkButton } from "@/components/ui/button";
import { Pagination } from "@/features/classroom/shared";
import type { ExamDetail, ExamSummary, VersionDetail } from "@/features/exam/types";
import { apiRoot, path, localDate, payload, accessLabels, displayLabels, releaseLabels, type Access, type SessionDetail, type Target, type PageResult } from "./types";
import { control, Field, panel, QueryState, message, Modal } from "./shared";
import { SessionSummary } from "./session-detail";

const steps = ["Chọn đề", "Lịch thi", "Đối tượng", "Trộn câu", "Kết quả", "Kiểm tra"];
type Form = { title: string; examVersionId: string; startTime: string; endTime: string; durationMinutes: string; maxAttempts: string; passingScore: string; accessType: Access; classrooms: Target[]; participants: Target[]; shuffleQuestions: boolean; shuffleAnswers: boolean; resultDisplayMode: keyof typeof displayLabels; resultReleasePolicy: keyof typeof releaseLabels };
function initial(s?: SessionDetail): Form {
  return s ? { title: s.title, examVersionId: s.examVersionId, startTime: localDate(s.startTime), endTime: localDate(s.endTime),
    durationMinutes: String(s.durationMinutes), maxAttempts: String(s.maxAttempts), passingScore: s.passingScore,
    accessType: s.accessType, classrooms: s.classrooms, participants: s.participants,
    shuffleQuestions: s.shuffleQuestions, shuffleAnswers: s.shuffleAnswers,
    resultDisplayMode: s.resultDisplayMode, resultReleasePolicy: s.resultReleasePolicy } :
    { title: "", examVersionId: "", startTime: "", endTime: "", durationMinutes: "", maxAttempts: "1", passingScore: "", accessType: "PUBLIC", classrooms: [], participants: [], shuffleQuestions: false, shuffleAnswers: false, resultDisplayMode: "SUMMARY", resultReleasePolicy: "AFTER_SESSION_END" };
}
function VersionPicker({ examId, selected, onSelect }: { examId: string; selected: string; onSelect: (id: string) => void }) {
  const q = useApiQuery<ExamDetail>(`/api/v1/exams/${examId}`);
  if (!q.data) return <QueryState error={q.error} retry={q.reload} />;
  const versions = q.data.versions.filter(v => v.status === "PUBLISHED");
  return <Field name="examVersionId" label="Phiên bản đã xuất bản"><select required id="examVersionId" className={control} value={selected} onChange={e => onSelect(e.target.value)}><option value="">Chọn phiên bản</option>{versions.map(v => <option key={v.id} value={v.id}>Phiên bản {v.versionNumber} · {v.questionCount} câu · {v.totalScore} điểm</option>)}</select>{!versions.length && <p>Đề chưa có phiên bản đã xuất bản.</p>}</Field>;
}
function VersionReview({ id }: { id: string }) {
  const q = useApiQuery<VersionDetail>(`/api/v1/exam-versions/${id}`);
  if (!q.data) return <QueryState error={q.error} retry={q.reload} />;
  return <p>{q.data.examName} · Phiên bản {q.data.versionNumber} · {q.data.questions.length} câu · {q.data.totalScore} điểm</p>;
}
function ExamPicker({ examId, setExamId, versionId, onVersion }: { examId: string; setExamId: (id: string) => void; versionId: string; onVersion: (id: string) => void }) {
  const [keyword, setKeyword] = useState(""), [search, setSearch] = useState(""), [page, setPage] = useState(0);
  const q = useApiQuery<PageResult<ExamSummary>>(`/api/v1/exams?status=ACTIVE&keyword=${encodeURIComponent(search)}&page=${page}`);
  return <div className="space-y-3"><Field name="examSearch" label="Tìm đề theo tên"><input id="examSearch" className={control} value={keyword} onChange={e => setKeyword(e.target.value)} maxLength={200} /></Field><Button variant="secondary" onClick={() => { setSearch(keyword); setPage(0); }}>Tìm đề</Button>
    {!q.data ? <QueryState error={q.error} retry={q.reload} /> : <><Field name="exam" label="Đề thi"><select id="exam" required className={control} value={examId} onChange={e => { setExamId(e.target.value); onVersion(""); }}><option value="">Chọn đề</option>{examId && !q.data.content.some(e => e.id === examId) && <option value={examId}>Đề đã chọn</option>}{q.data.content.map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select></Field><Pagination result={q.data} onPage={setPage} /></>}
    {examId && <VersionPicker examId={examId} selected={versionId} onSelect={onVersion} />}
  </div>;
}
function ClassPicker({ selected, onChange }: { selected: Target[]; onChange: (t: Target[]) => void }) {
  const [search, setSearch] = useState(""), [page, setPage] = useState(0);
  const q = useApiQuery<PageResult<Target>>(`/api/v1/classrooms?search=${encodeURIComponent(search)}&page=${page}`);
  return <div className="space-y-3"><Field name="classSearch" label="Tìm lớp"><input id="classSearch" className={control} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></Field>
    {!q.data ? <QueryState error={q.error} retry={q.reload} /> : <><div className="space-y-2">{q.data.content.map(c => <label key={c.id} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={selected.some(t => t.id === c.id)} onChange={e => onChange(e.target.checked ? [...selected, { id: c.id, name: c.name }] : selected.filter(t => t.id !== c.id))} />{c.name}</label>)}</div><Pagination result={q.data} onPage={setPage} /></>}
    <p>Đã chọn {selected.length} lớp</p><div className="flex flex-wrap gap-2">{selected.map(c => <Button key={c.id} variant="secondary" onClick={() => onChange(selected.filter(t => t.id !== c.id))}>Bỏ {c.name}</Button>)}</div>
  </div>;
}
function ParticipantPicker({ selected, onChange }: { selected: Target[]; onChange: (t: Target[]) => void }) {
  const { session } = useAuth(); const [email, setEmail] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function lookup() {
    setBusy(true); setError("");
    try { const p = await session.api.request<{ userId: string; displayName: string }>(`${apiRoot}/participants/lookup?email=${encodeURIComponent(email.trim())}`); if (!selected.some(t => t.id === p.userId)) onChange([...selected, { id: p.userId, name: p.displayName }]); setEmail(""); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <div className="space-y-3"><Field name="participantEmail" label="Email chính xác của người tham gia"><input id="participantEmail" type="email" className={control} value={email} maxLength={254} onChange={e => setEmail(e.target.value)} /></Field><Button variant="secondary" disabled={busy || !email.trim()} onClick={() => void lookup()}>{busy ? "Đang tìm…" : "Tìm và thêm"}</Button>{error && <p role="alert" className="text-danger">{error}</p>}<ul className="space-y-2">{selected.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2"><span>{p.name}</span><Button variant="secondary" onClick={() => onChange(selected.filter(t => t.id !== p.id))}>Bỏ {p.name}</Button></li>)}</ul></div>;
}
export function EditSession({ id }: { id: string }) {
  const q = useApiQuery<SessionDetail>(`${apiRoot}/${id}`);
  if (!q.data) return <QueryState error={q.error} retry={q.reload} />;
  if (!q.data.actions.editTitle) return <div className={panel}><p>Kỳ thi đã đóng hoặc hủy, không thể chỉnh sửa.</p><LinkButton href={path(id)}>Xem kỳ thi</LinkButton></div>;
  return <SessionForm existing={q.data} />;
}
export function SessionForm({ existing }: { existing?: SessionDetail }) {
  const params = useSearchParams(), router = useRouter(), { session } = useAuth();
  const [form, setForm] = useState<Form>(() => ({ ...initial(existing), examVersionId: existing?.examVersionId ?? params.get("versionId") ?? "" }));
  const [examId, setExamId] = useState(existing?.examId ?? params.get("examId") ?? "");
  const [saved, setSaved] = useState(existing), [remote, setRemote] = useState<SessionDetail>();
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const locked = saved && !saved.actions.editConfiguration;
  const put = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }));
  function changeStep(value: number) { setStep(value); requestAnimationFrame(() => heading.current?.focus()); }
  function inputProps(name: keyof Form) { return { id: name, className: control, "aria-invalid": !!errors[name], "aria-describedby": errors[name] ? `${name}-error` : undefined }; }
  function validateAll() {
    const found: Record<string, string> = {};
    if (!form.title.trim()) found.title = "Nhập tên kỳ thi.";
    if (!form.examVersionId) found.examVersionId = "Chọn phiên bản đã xuất bản.";
    if (!form.startTime) found.startTime = "Nhập giờ bắt đầu.";
    if (!form.endTime || new Date(form.endTime) <= new Date(form.startTime)) found.endTime = "Giờ kết thúc phải sau giờ bắt đầu.";
    if (!/^[1-9]\d*$/.test(form.durationMinutes)) found.durationMinutes = "Nhập số phút nguyên dương.";
    if (!/^[1-9]\d*$/.test(form.maxAttempts)) found.maxAttempts = "Nhập số lượt nguyên dương.";
    if (!/^\d+(\.\d{1,10})?$/.test(form.passingScore)) found.passingScore = "Nhập điểm không âm, dùng dấu chấm.";
    if ((form.accessType === "CLASS" && !form.classrooms.length) || (form.accessType === "INDIVIDUAL" && !form.participants.length)) found.accessType = "Chọn ít nhất một đối tượng.";
    setErrors(found); return Object.keys(found).length === 0;
  }
  async function save(schedule: boolean) {
    if (!validateAll()) { setError("Thông tin chưa đầy đủ. Quay lại các bước có lỗi để kiểm tra."); return; }
    setBusy(true); setError(""); setErrors({});
    try {
      const body = locked && saved ? { ...payload(saved), title: form.title } : {
        ...form, classrooms: undefined, participants: undefined, revision: saved?.revision,
        startTime: saved && localDate(saved.startTime) === form.startTime ? saved.startTime : new Date(form.startTime).toISOString(),
        endTime: saved && localDate(saved.endTime) === form.endTime ? saved.endTime : new Date(form.endTime).toISOString(),
        durationMinutes: Number(form.durationMinutes), maxAttempts: Number(form.maxAttempts),
        classroomIds: form.classrooms.map(t => t.id), participantIds: form.participants.map(t => t.id),
      };
      const result = await session.api.request<SessionDetail>(saved ? `${apiRoot}/${saved.id}` : apiRoot, { method: saved ? "PUT" : "POST", json: body });
      setSaved(result);
      if (schedule) await session.api.request(`${apiRoot}/${result.id}/schedule`, { method: "POST", json: { revision: result.revision } });
      router.push(path(result.id));
    } catch (cause) {
      setError(message(cause));
      if (cause instanceof ApiError) setErrors(Object.fromEntries((cause.problem?.fieldErrors ?? []).map(f => [f.field, f.message])));
    } finally { setBusy(false); }
  }
  return <div className="space-y-5"><LinkButton variant="ghost" href={saved ? path(saved.id) : "/creator/sessions"}>Quay lại</LinkButton>
    <p>Múi giờ nhập lịch: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Thời gian thực tế do máy chủ quyết định.</p>
    {locked && <p className="rounded bg-muted p-4">Cấu hình đã khóa. Bạn chỉ có thể sửa tên kỳ thi.</p>}
    {!locked && <nav aria-label="Các bước tạo kỳ thi" className="flex flex-wrap gap-2">{steps.map((label, i) => <Button key={label} variant={step === i ? "primary" : "secondary"} aria-current={step === i ? "step" : undefined} disabled={busy} onClick={() => changeStep(i)}>{i + 1}. {label}</Button>)}</nav>}
    <form ref={formRef} className={`${panel} space-y-5`} onSubmit={e => { e.preventDefault(); if (!locked && step < 5) changeStep(step + 1); else void save(false); }}>
      <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">{locked ? "Sửa tên kỳ thi" : `Bước ${step + 1}/6 — ${steps[step]}`}</h2>
      <fieldset disabled={busy} className="space-y-5">
      {(step === 0 || locked) && <><Field name="title" label="Tên kỳ thi" error={errors.title}><input {...inputProps("title")} required maxLength={200} value={form.title} onChange={e => put("title", e.target.value)} /></Field>
        {!locked && <ExamPicker examId={examId} setExamId={setExamId} versionId={form.examVersionId} onVersion={id => put("examVersionId", id)} />}{errors.examVersionId && <p role="alert" className="text-danger">{errors.examVersionId}</p>}</>}
      {step === 1 && !locked && <div className="grid gap-4 sm:grid-cols-2">
        <Field name="startTime" label="Giờ bắt đầu" error={errors.startTime}><input {...inputProps("startTime")} required type="datetime-local" value={form.startTime} onChange={e => put("startTime", e.target.value)} /></Field>
        <Field name="endTime" label="Giờ kết thúc" error={errors.endTime}><input {...inputProps("endTime")} required type="datetime-local" disabled={saved?.status === "SCHEDULED"} value={form.endTime} onChange={e => put("endTime", e.target.value)} />{saved?.status === "SCHEDULED" && <p>Dùng action Gia hạn trên trang chi tiết để tăng giờ kết thúc.</p>}</Field>
        <Field name="durationMinutes" label="Thời lượng (phút)" error={errors.durationMinutes}><input {...inputProps("durationMinutes")} required type="number" min="1" step="1" max="2147483647" value={form.durationMinutes} onChange={e => put("durationMinutes", e.target.value)} /></Field>
        <Field name="maxAttempts" label="Số lượt tối đa" error={errors.maxAttempts}><input {...inputProps("maxAttempts")} required type="number" min="1" step="1" max="2147483647" value={form.maxAttempts} onChange={e => put("maxAttempts", e.target.value)} /></Field>
        <Field name="passingScore" label="Điểm đạt" error={errors.passingScore}><input {...inputProps("passingScore")} required inputMode="decimal" maxLength={42} value={form.passingScore} onChange={e => put("passingScore", e.target.value)} /></Field>
      </div>}
      {step === 2 && !locked && <><Field name="accessType" label="Loại truy cập" error={errors.accessType}><select {...inputProps("accessType")} value={form.accessType} onChange={e => setForm(f => ({ ...f, accessType: e.target.value as Access, classrooms: [], participants: [] }))}>{Object.entries(accessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        {form.accessType === "PUBLIC" ? <p>Mọi người dùng đã đăng nhập có role PARTICIPANT đều có thể tham gia khi kỳ thi mở.</p> : form.accessType === "CLASS" ? <ClassPicker selected={form.classrooms} onChange={v => put("classrooms", v)} /> : <ParticipantPicker selected={form.participants} onChange={v => put("participants", v)} />}</>}
      {step === 3 && !locked && <>{(["shuffleQuestions", "shuffleAnswers"] as const).map((name, i) => <label key={name} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={form[name]} onChange={e => put(name, e.target.checked)} />{i ? "Trộn thứ tự đáp án" : "Trộn thứ tự câu hỏi"}</label>)}<p>Thứ tự được giữ ổn định trong mỗi lượt làm bài.</p></>}
      {step === 4 && !locked && <><Field name="resultDisplayMode" label="Hiển thị kết quả"><select id="resultDisplayMode" className={control} value={form.resultDisplayMode} onChange={e => put("resultDisplayMode", e.target.value as Form["resultDisplayMode"])}>{Object.entries(displayLabels).map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></Field><Field name="resultReleasePolicy" label="Thời điểm công bố"><select id="resultReleasePolicy" className={control} value={form.resultReleasePolicy} onChange={e => put("resultReleasePolicy", e.target.value as Form["resultReleasePolicy"])}>{Object.entries(releaseLabels).map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></Field><p>Đáp án và giải thích chỉ hiển thị khi chế độ Chi tiết và chính sách công bố cho phép.</p></>}
      {step === 5 && !locked && <div className="space-y-3 [overflow-wrap:anywhere]"><h3 className="font-bold">{form.title || "Chưa đặt tên"}</h3>{form.examVersionId ? <VersionReview id={form.examVersionId} /> : <p>Chưa chọn phiên bản</p>}<p>{form.startTime || "Chưa nhập giờ bắt đầu"} → {form.endTime || "Chưa nhập giờ kết thúc"}</p><p>{form.durationMinutes} phút · {form.maxAttempts} lượt · Điểm đạt {form.passingScore}</p><p>{accessLabels[form.accessType]} {([...form.classrooms, ...form.participants]).map(t => t.name).join(", ")}</p><p>Trộn câu: {form.shuffleQuestions ? "Có" : "Không"} · Trộn đáp án: {form.shuffleAnswers ? "Có" : "Không"}</p><p>{displayLabels[form.resultDisplayMode]} · {releaseLabels[form.resultReleasePolicy]}</p></div>}
      </fieldset>
      {error && <div role="alert" className="space-y-2 text-danger"><p>{error}</p>{Object.entries(errors).map(([k, v]) => <p key={k}>{v}</p>)}{saved && <Button variant="secondary" disabled={busy} onClick={async () => { try { setRemote(await session.api.request<SessionDetail>(`${apiRoot}/${saved.id}`)); } catch (e) { setError(message(e)); } }}>Tải bản máy chủ để đối chiếu</Button>}</div>}
      <div className="flex flex-wrap gap-3">{!locked && step > 0 && <Button variant="secondary" disabled={busy} onClick={() => changeStep(step - 1)}>Trước</Button>}
        <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : !locked && step < 5 ? "Tiếp tục" : saved ? "Lưu thay đổi" : "Lưu nháp"}</Button>
        {!locked && step === 5 && (!saved || saved.actions.schedule) && <Button variant="secondary" disabled={busy} onClick={() => void save(true)}>Lưu và lên lịch</Button>}
      </div>
    </form>
    {remote && <Modal title="Đối chiếu bản máy chủ" close={() => setRemote(undefined)}><div className="space-y-4"><p>Thông tin đang nhập vẫn được giữ. Chọn dùng bản máy chủ sẽ thay nội dung biểu mẫu.</p><SessionSummary s={remote} /><Button onClick={() => { setSaved(remote); setForm(initial(remote)); setExamId(remote.examId); setRemote(undefined); setError(""); setErrors({}); }}>Dùng bản máy chủ</Button></div></Modal>}
  </div>;
}
