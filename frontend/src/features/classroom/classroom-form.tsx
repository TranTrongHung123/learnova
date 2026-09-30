"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { apiRoot, classroomMessage, control, ErrorText, panel } from "./shared";
import type { ClassroomDetail } from "./types";

export function ClassroomForm({ existing, onSaved, onCancel }: { existing?: ClassroomDetail; onSaved?: () => void; onCancel?: () => void }) {
  const { session } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setFields({});
    if (!name.trim()) { setFields({ name: "Vui lòng nhập tên lớp." }); document.getElementById("class-name")?.focus(); return; }
    setBusy(true);
    try {
      const saved = await session.api.request<ClassroomDetail>(existing ? `${apiRoot}/${existing.id}` : apiRoot,
        { method: existing ? "PUT" : "POST", json: { name: name.trim(), description: description.trim() || null } });
      if (onSaved) onSaved(); else router.push(`/creator/classes/${saved.id}`);
    } catch (cause) {
      setError(classroomMessage(cause));
      if (cause instanceof ApiError) setFields(Object.fromEntries((cause.problem?.fieldErrors ?? []).map((field) => [field.field, "Thông tin không hợp lệ. Vui lòng kiểm tra."])));
    } finally { setBusy(false); }
  }
  return <form onSubmit={(event) => void submit(event)} className={`${panel} max-w-2xl space-y-5`}>
    <Input id="class-name" label="Tên lớp" required maxLength={200} value={name} error={fields.name} onChange={(e) => setName(e.target.value)} />
    <div className="space-y-2"><label htmlFor="class-description" className="block text-sm font-semibold">Mô tả</label>
      <textarea id="class-description" className={control} rows={5} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!fields.description} aria-describedby="description-hint" />
      <p id="description-hint" className="text-sm text-muted-foreground">Tối đa 2.000 ký tự. {fields.description}</p></div>
    <ErrorText message={error} />
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : existing ? "Lưu thay đổi" : "Tạo lớp"}</Button>
      {onCancel ? <Button variant="secondary" disabled={busy} onClick={onCancel}>Hủy</Button> : <LinkButton variant="secondary" href="/creator/classes">Quay lại</LinkButton>}</div>
  </form>;
}
