"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { Button, LinkButton } from "@/components/ui/button";
import { control, Field, message, panel } from "./shared";
import { versionPath, type ExamDetail } from "./types";

export function ExamCreate() {
  const { session } = useAuth(), router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [fields, setFields] = useState<Record<string, string>>({});
  return <form className={`${panel} max-w-2xl space-y-5`} onSubmit={async e => {
    e.preventDefault(); if (busy) return; const data = new FormData(e.currentTarget); setBusy(true); setError(""); setFields({});
    try {
      const result = await session.api.request<ExamDetail>("/api/v1/exams", { method: "POST", json: { name: data.get("name"), description: data.get("description") } });
      router.push(versionPath(result.id, result.versions[0].id, true));
    } catch (cause) { setError(message(cause)); if (cause instanceof ApiError) setFields(Object.fromEntries((cause.problem?.fieldErrors ?? []).map(f => [f.field, f.message]))); setBusy(false); }
  }}>
    <p>Tạo đề và phiên bản 1 ở trạng thái bản nháp. Bạn sẽ thêm câu hỏi ở bước tiếp theo.</p>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <Field name="name" label="Tên đề thi" error={fields.name}><input className={control} id="name" name="name" required maxLength={200} aria-invalid={!!fields.name} aria-describedby={fields.name ? "name-error" : undefined} /></Field>
    <Field name="description" label="Mô tả" error={fields.description}><textarea className={control} id="description" name="description" maxLength={5000} rows={4} aria-invalid={!!fields.description} aria-describedby={fields.description ? "description-error" : undefined} /></Field>
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{busy ? "Đang tạo…" : "Tạo đề và mở bản nháp"}</Button><LinkButton variant="ghost" href="/creator/exams">Hủy</LinkButton></div>
  </form>;
}
