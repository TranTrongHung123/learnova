"use client";

import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRoot, classroomMessage, ErrorText, panel } from "./shared";
import type { JoinPreview } from "./types";

export function JoinClassroom() {
  const { session } = useAuth();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<JoinPreview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  async function check() {
    setBusy(true); setError(""); setPreview(undefined); setJoined(false);
    try { setPreview(await session.api.request<JoinPreview>(`${apiRoot}/join-preview`, { method: "POST", json: { code: code.trim() } })); }
    catch (cause) { setError(classroomMessage(cause)); } finally { setBusy(false); }
  }
  async function join() {
    setBusy(true); setError("");
    try { await session.api.request(`${apiRoot}/join`, { method: "POST", json: { code: code.trim() } }); setJoined(true); }
    catch (cause) { setError(classroomMessage(cause)); setPreview(undefined); } finally { setBusy(false); }
  }
  return <div className="max-w-2xl space-y-6"><p className="text-muted-foreground">Kiểm tra thông tin lớp trước khi xác nhận tham gia.</p>
    <form className={`${panel} space-y-4`} onSubmit={(e) => { e.preventDefault(); void check(); }}>
      <Input id="join-code" label="Mã tham gia" hint="Nhập mã do người tạo lớp cung cấp." required maxLength={64} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy}
        value={code} onChange={(e) => { setCode(e.target.value); setPreview(undefined); setJoined(false); setError(""); }} />
      <Button type="submit" disabled={busy}>{busy ? "Đang xử lý…" : "Kiểm tra mã"}</Button>
    </form>
    <ErrorText message={error} />
    {preview && <section className={`${panel} space-y-4`} aria-label="Thông tin lớp trước khi tham gia"><h2 className="text-xl font-bold [overflow-wrap:anywhere]">{preview.name}</h2>
      <p className="[overflow-wrap:anywhere]">Người tạo: {preview.creatorName}</p><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{preview.description || "Chưa có mô tả."}</p>
      {joined || preview.membershipStatus === "ACTIVE" ? <><p role="status" className="text-success">{joined ? "Đã tham gia lớp thành công." : "Bạn đã tham gia lớp này."}</p><LinkButton href="/participant/classes">Đến lớp học của tôi</LinkButton></> :
        <><p>{preview.membershipStatus === "REMOVED" ? "Bạn từng rời lớp này. Xác nhận để tham gia lại." : "Xác nhận nếu đây là lớp bạn muốn tham gia."}</p><Button disabled={busy} onClick={() => void join()}>Xác nhận tham gia</Button></>}
    </section>}
    <LinkButton variant="secondary" href="/participant/classes">Quay lại lớp học của tôi</LinkButton>
  </div>;
}
