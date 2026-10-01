"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { apiRoot, control, Field, message, panel } from "./shared";
import { difficultyLabels, typeLabels, type QuestionDetail, type QuestionType, type QuestionWrite, type Difficulty } from "./types";

export function QuestionForm({ existing }: { existing?: QuestionDetail }) {
  const { session } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<QuestionWrite>({ type: existing?.type ?? "SINGLE_CHOICE", status: existing?.status ?? "DRAFT",
    content: existing?.content ?? "", explanation: existing?.explanation ?? "", category: existing?.category ?? "", difficulty: existing?.difficulty ?? null,
    tags: existing?.tags ?? [], options: existing?.options ?? [{ content: "", correct: false }, { content: "", correct: false }],
    correctBoolean: existing?.correctBoolean ?? null, correctValue: existing?.correctValue ?? null, tolerance: existing?.tolerance ?? "0",
    ...(existing ? { revision: existing.revision } : {}) });
  const [tags, setTags] = useState(existing?.tags.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) summary.current?.focus(); }, [error, fields]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function patch(value: Partial<QuestionWrite>) { setDirty(true); setForm(current => ({ ...current, ...value })); }
  function changeType(type: QuestionType) {
    if (dirty && !window.confirm("Đổi loại câu hỏi sẽ xóa phần đáp án đang nhập. Tiếp tục?")) return;
    patch({ type, options: type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE" ? [{ content: "", correct: false }, { content: "", correct: false }] : [],
      correctBoolean: null, correctValue: null, tolerance: "0" });
  }
  async function save(status: "DRAFT" | "ACTIVE") {
    if (busy) return;
    setBusy(true); setError(""); setFields({}); setConflict(false);
    try {
      const saved = await session.api.request<QuestionDetail>(existing ? `${apiRoot}/${existing.id}` : apiRoot, {
        method: existing ? "PUT" : "POST",
        json: {
          ...form,
          status,
          tolerance: form.tolerance || null,
          tags: [...new Set(tags.split(",").map(t => t.trim()).filter(Boolean))],
        },
      });
      setDirty(false); router.push(`/creator/questions/${saved.id}?saved=1`);
    } catch (cause) {
      setError(message(cause));
      if (cause instanceof ApiError) {
        setConflict(cause.status === 409);
        setFields(Object.fromEntries((cause.problem?.fieldErrors ?? []).map(f => [f.field, f.message])));
      }
    } finally { setBusy(false); }
  }
  const choice = form.type === "SINGLE_CHOICE" || form.type === "MULTIPLE_CHOICE";
  const described = (name: string) => ({ "aria-invalid": !!fields[name], "aria-describedby": fields[name] ? `${name}-error` : undefined });
  return <form onSubmit={event => { event.preventDefault(); void save("ACTIVE"); }} className={`${panel} max-w-3xl space-y-6`}>
    <p className="text-muted-foreground">{existing?.status === "ACTIVE" ? "Câu hỏi đang sử dụng. Nội dung và đáp án phải hợp lệ khi lưu thay đổi." : "Lưu bản nháp để tiếp tục soạn sau. Kích hoạt khi nội dung và đáp án đã hoàn chỉnh."}</p>
    {existing && <p className="text-sm text-muted-foreground">Sửa ngân hàng câu hỏi không thay đổi phiên bản đề đã xuất bản.</p>}
    {error && <div ref={summary} tabIndex={-1} role="alert" className="space-y-2 rounded-lg border border-danger p-4 text-danger"><p>{error}</p>
      <ul>{Object.entries(fields).map(([name, text]) => <li key={name}><a className="underline" href={`#${name}`}>{text}</a></li>)}</ul>
      {conflict && existing && <LinkButton variant="secondary" href={`/creator/questions/${existing.id}`} target="_blank">Mở dữ liệu mới nhất ở tab khác</LinkButton>}</div>}
    <fieldset disabled={busy} className="space-y-5">
      <Field name="type" label="Loại câu hỏi" error={fields.type}><select id="type" className={control} value={form.type} onChange={e => changeType(e.target.value as QuestionType)} {...described("type")}>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field name="content" label="Nội dung câu hỏi" error={fields.content}><textarea id="content" rows={5} maxLength={10000} className={control} value={form.content} onChange={e => patch({ content: e.target.value })} {...described("content")} /></Field>
      {choice && <fieldset id="options" tabIndex={-1} aria-describedby={fields.options ? "options-error" : undefined} className="space-y-3"><legend className="mb-3 font-semibold">Lựa chọn và đáp án đúng</legend>
        <p className="text-sm text-muted-foreground">{form.type === "SINGLE_CHOICE" ? "Chọn đúng một đáp án." : "Chọn một hoặc nhiều đáp án đúng."}</p>
        {fields.options && <p id="options-error" className="text-danger">{fields.options}</p>}
        {form.options.map((option, i) => <div key={i} className="rounded-lg border border-border p-3 space-y-2">
          <Input id={`options[${i}].content`} label={`Lựa chọn ${i + 1}`} maxLength={2000} value={option.content} error={fields[`options[${i}].content`]} onChange={e => patch({ options: form.options.map((o, n) => n === i ? { ...o, content: e.target.value } : o) })} />
          <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-h-11 items-center gap-2"><input type={form.type === "SINGLE_CHOICE" ? "radio" : "checkbox"} name="correct-option" checked={option.correct} onChange={e => patch({ options: form.options.map((o, n) => ({ ...o, correct: n === i ? e.target.checked : form.type === "SINGLE_CHOICE" ? false : o.correct })) })} />Đáp án đúng {i + 1}</label>
            <Button variant="ghost" onClick={() => patch({ options: form.options.filter((_, n) => n !== i) })}>Xóa lựa chọn {i + 1}</Button></div></div>)}
        <Button variant="secondary" disabled={form.options.length >= 20} onClick={() => patch({ options: [...form.options, { content: "", correct: false }] })}>Thêm lựa chọn</Button>
      </fieldset>}
      {form.type === "TRUE_FALSE" && <Field name="correctBoolean" label="Đáp án đúng" error={fields.correctBoolean}><select id="correctBoolean" className={control} value={form.correctBoolean === null ? "" : String(form.correctBoolean)} onChange={e => patch({ correctBoolean: e.target.value === "" ? null : e.target.value === "true" })} {...described("correctBoolean")}><option value="">Chưa chọn</option><option value="true">Đúng</option><option value="false">Sai</option></select></Field>}
      {form.type === "NUMERIC_ANSWER" && <div className="grid gap-4 sm:grid-cols-2"><Input id="correctValue" label="Đáp án số" inputMode="decimal" value={form.correctValue ?? ""} error={fields.correctValue} onChange={e => patch({ correctValue: e.target.value || null })} hint="Dùng dấu chấm cho phần thập phân." /><Input id="tolerance" label="Sai số tuyệt đối" inputMode="decimal" value={form.tolerance} error={fields.tolerance} onChange={e => patch({ tolerance: e.target.value })} hint="Mặc định 0, không được âm." /></div>}
      <div className="grid gap-4 sm:grid-cols-2"><Field name="difficulty" label="Độ khó" error={fields.difficulty}><select id="difficulty" className={control} value={form.difficulty ?? ""} onChange={e => patch({ difficulty: (e.target.value || null) as Difficulty | null })}><option value="">Chưa phân loại</option>{Object.entries(difficultyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Input id="category" label="Danh mục" maxLength={100} value={form.category ?? ""} error={fields.category} onChange={e => patch({ category: e.target.value })} /></div>
      <Input id="tags" label="Nhãn / chủ đề" value={tags} error={fields.tags} hint="Phân cách bằng dấu phẩy. Tối đa 20 nhãn, 50 ký tự mỗi nhãn." onChange={e => { setDirty(true); setTags(e.target.value); }} />
      <Field name="explanation" label="Giải thích đáp án" error={fields.explanation}><textarea id="explanation" rows={4} maxLength={10000} className={control} value={form.explanation ?? ""} onChange={e => patch({ explanation: e.target.value })} {...described("explanation")} /></Field>
    </fieldset>
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : existing?.status === "ACTIVE" ? "Lưu thay đổi" : "Lưu và kích hoạt"}</Button>
      {existing?.status !== "ACTIVE" && <Button variant="secondary" disabled={busy} onClick={() => void save("DRAFT")}>Lưu nháp</Button>}
      <Button variant="ghost" disabled={busy} onClick={() => { if (!dirty || window.confirm("Bỏ thay đổi chưa lưu?")) router.push(existing ? `/creator/questions/${existing.id}` : "/creator/questions"); }}>Hủy</Button></div>
  </form>;
}
