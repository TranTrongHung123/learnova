"use client";

import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { message } from "@/features/session/shared";

export function ExportButton({ id }: { id: string }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const blob = await session.api.request<Blob>(`/api/v1/exam-sessions/${id}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `session-${id}.xlsx`; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  return <div className="space-y-2"><Button disabled={busy} onClick={() => void download()}>{busy ? "Đang xuất Excel…" : "Xuất Excel"}</Button>
    <p className="text-sm text-muted-foreground">Tất cả lượt làm, không giới hạn theo trang hiện tại.</p>
    {error && <p role="alert" className="text-danger">{error}</p>}</div>;
}
