"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { difficultyLabels, typeLabels, type Difficulty, type QuestionType } from "@/features/question/types";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { control, Field, message, Modal } from "./shared";
import type { VersionDetail } from "./types";

type Rule = { key: number; category: string; difficulty: Difficulty | ""; questionType: QuestionType | ""; quantity: string };
type Availability = { ruleIndex: number; requested: number; candidateCount: number; allocatedCount: number; missingCount: number };
type Preview = { revision: number; canGenerate: boolean; rules: Availability[] };
function availability(value: unknown): Preview | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Preview;
  return Number.isInteger(p.revision) && typeof p.canGenerate === "boolean" && Array.isArray(p.rules)
    && p.rules.every(r => r && [r.ruleIndex, r.requested, r.candidateCount, r.allocatedCount, r.missingCount].every(n => Number.isInteger(n) && n >= 0)) ? p : null;
}
const emptyRule = (key: number): Rule => ({ key, category: "", difficulty: "", questionType: "", quantity: "1" });

export function MatrixGenerator({ version, close, accept }: { version: VersionDetail; close: () => void; accept: (version: VersionDetail) => void }) {
  const { session } = useAuth();
  const [rules, setRules] = useState<Rule[]>([emptyRule(0)]), nextKey = useRef(1);
  const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [fields, setFields] = useState<Record<string, string>>({});
  const [blocked, setBlocked] = useState(false), [remote, setRemote] = useState<VersionDetail | null>(null);
  const inFlight = useRef(false), errorRef = useRef<HTMLDivElement>(null);
  const endpoint = `/api/v1/exam-versions/${version.id}`;
  function change(next: Rule[]) { setRules(next); setPreview(null); setError(""); setFields({}); }
  function update(index: number, patch: Partial<Rule>) { change(rules.map((r, i) => i === index ? { ...r, ...patch } : r)); }
  function focusError() { requestAnimationFrame(() => errorRef.current?.focus()); }
  async function run(action: "preview" | "generate" | "reload") {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setFields({});
    try {
      if (action === "reload") { setRemote(await session.api.request<VersionDetail>(endpoint)); return; }
      const invalid: Record<string, string> = {};
      rules.forEach((r, i) => {
        if (!/^\d+$/.test(r.quantity) || Number(r.quantity) < 1 || Number(r.quantity) > 500) invalid[`rules[${i}].quantity`] = "Nhập số nguyên từ 1 đến 500.";
      });
      if (rules.reduce((sum, r) => sum + Number(r.quantity || 0), 0) > 500) invalid.rules = "Mỗi lần sinh tối đa 500 câu hỏi.";
      if (Object.keys(invalid).length) { setFields(invalid); setError("Kiểm tra các trường của ma trận."); focusError(); return; }
      const json = { revision: version.revision, rules: rules.map(r => ({ category: r.category.trim() || null, difficulty: r.difficulty || null, questionType: r.questionType || null, quantity: Number(r.quantity) })) };
      if (action === "preview") {
        setPreview(null);
        setPreview(await session.api.request<Preview>(`${endpoint}/generation/preview`, { method: "POST", json }));
      } else {
        setPreview(null);
        accept(await session.api.request<VersionDetail>(`${endpoint}/generation`, { method: "POST", json }));
      }
    } catch (cause) {
      const insufficient = cause instanceof ApiError && cause.problem?.code === "EXAM_MATRIX_INSUFFICIENT_CANDIDATES";
      setError(insufficient ? "Không đủ câu hỏi cho toàn ma trận. Bản nháp chưa bị thay đổi." : message(cause));
      if (cause instanceof ApiError) {
        setFields(Object.fromEntries((cause.problem?.fieldErrors ?? []).map(f => [f.field, f.message])));
        if (insufficient) setPreview(availability(cause.problem?.availability));
      }
      const uncertain = action === "generate" && (!(cause instanceof ApiError) || cause.kind !== "http" || cause.status >= 500);
      const conflict = cause instanceof ApiError && cause.status === 409 && !insufficient;
      if (uncertain || conflict) {
        setBlocked(true); setPreview(null);
        if (uncertain) setError("Chưa xác nhận được kết quả sinh đề. Đọc bản máy chủ để đối chiếu trước khi tiếp tục; không tự gửi lại.");
        try { setRemote(await session.api.request<VersionDetail>(endpoint)); } catch { /* Giữ trạng thái chặn đến khi người dùng đọc lại thành công. */ }
      }
      focusError();
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <Modal title="Sinh đề theo ma trận" close={close} busy={busy}>
    <p className="mb-4 text-muted-foreground">Chỉ dùng câu đang sử dụng của bạn, loại câu đã có trong đề và không chọn trùng giữa các dòng. Bỏ trống tiêu chí để lấy tất cả. Câu mới có 1 điểm, có thể sửa sau khi sinh.</p>
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="mb-4 space-y-2 text-danger"><p>{error}</p>{Object.entries(fields).map(([field, text]) => <p key={field}><a className="underline" href={`#matrix-${field}`}>{text}</a></p>)}</div>}
    <form onSubmit={e => { e.preventDefault(); void run("preview"); }} className="space-y-4">
      <fieldset id="matrix-rules" disabled={busy || blocked} className="min-w-0 space-y-4">
        <legend className="mb-2 font-semibold">Ma trận câu hỏi (tối đa 50 dòng, 500 câu mỗi lần)</legend>
        {rules.map((r, i) => <fieldset key={r.key} className="min-w-0 space-y-3 rounded-lg border border-border p-3">
          <legend className="px-1 font-semibold">Dòng {i + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name={`matrix-rules[${i}].category`} label={`Danh mục / Chủ đề dòng ${i + 1}`} error={fields[`rules[${i}].category`]}>
              <input id={`matrix-rules[${i}].category`} className={control} maxLength={100} value={r.category} onChange={e => update(i, { category: e.target.value })} />
            </Field>
            <Field name={`matrix-difficulty-${r.key}`} label={`Độ khó dòng ${i + 1}`}><select id={`matrix-difficulty-${r.key}`} className={control} value={r.difficulty} onChange={e => update(i, { difficulty: e.target.value as Rule["difficulty"] })}><option value="">Tất cả độ khó</option>{Object.entries(difficultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field name={`matrix-type-${r.key}`} label={`Loại câu dòng ${i + 1}`}><select id={`matrix-type-${r.key}`} className={control} value={r.questionType} onChange={e => update(i, { questionType: e.target.value as Rule["questionType"] })}><option value="">Tất cả loại câu</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field name={`matrix-rules[${i}].quantity`} label={`Số lượng dòng ${i + 1}`} error={fields[`rules[${i}].quantity`]}><input id={`matrix-rules[${i}].quantity`} className={control} inputMode="numeric" value={r.quantity} aria-invalid={!!fields[`rules[${i}].quantity`]} aria-describedby={fields[`rules[${i}].quantity`] ? `matrix-rules[${i}].quantity-error` : undefined} onChange={e => update(i, { quantity: e.target.value })} /></Field>
          </div>
          <Button variant="ghost" disabled={rules.length === 1} onClick={() => change(rules.filter((_, index) => i !== index))}>Xóa dòng {i + 1}</Button>
        </fieldset>)}
        <Button variant="secondary" disabled={rules.length >= 50} onClick={() => change([...rules, emptyRule(nextKey.current++)])}>Thêm dòng</Button>
      </fieldset>
      {fields.rules && <p className="text-danger">{fields.rules}</p>}
      {preview && <section aria-label="Kết quả kiểm tra ma trận" className="space-y-2 rounded-lg border border-border p-3">
        <p role="status" className={preview.canGenerate ? "font-semibold text-success" : "font-semibold text-danger"}>{preview.canGenerate ? "Đủ câu hỏi cho toàn ma trận" : "Chưa đủ câu hỏi cho toàn ma trận"}</p>
        {preview.rules.map(r => <p key={r.ruleIndex}>Dòng {r.ruleIndex + 1}: yêu cầu {r.requested} · Phù hợp {r.candidateCount} · Phân bổ {r.allocatedCount} · Thiếu {r.missingCount}</p>)}
        <p className="text-sm text-muted-foreground">Số phù hợp tính riêng từng dòng; phân bổ đã loại trùng toàn ma trận và ưu tiên dòng trước khi thiếu. Kết quả chỉ tại thời điểm kiểm tra, hệ thống sẽ kiểm tra lại khi sinh.</p>
      </section>}
      <div className="flex flex-wrap gap-3"><Button type="submit" variant="secondary" disabled={busy || blocked}>Kiểm tra số lượng</Button><Button disabled={busy || blocked || !preview?.canGenerate} onClick={() => void run("generate")}>Sinh và thêm vào bản nháp</Button></div>
      {busy && <p role="status">Đang xử lý ma trận…</p>}
    </form>
    {blocked && <section className="mt-4 space-y-3 rounded-lg border border-border p-3"><h3 className="font-semibold">Đối chiếu bản máy chủ</h3>
      {remote ? <><p>Revision {remote.revision} · {remote.status} · {remote.questions.length} câu · {remote.totalScore} điểm</p><p>Bản đã mở trước đó có {version.questions.length} câu, revision {version.revision}. Kiểm tra nội dung trong Builder trước khi sinh thêm.</p><Button disabled={busy} onClick={() => accept(remote)}>Dùng bản máy chủ và quay lại Builder</Button></> : <Button disabled={busy} onClick={() => void run("reload")}>Đọc lại bản máy chủ</Button>}
    </section>}
  </Modal>;
}
