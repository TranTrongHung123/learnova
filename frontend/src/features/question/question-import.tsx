"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { Button, LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/page-state";
import { control, panel, useQuestion } from "./shared";
import { typeLabels } from "./types";

const root = "/api/v1/question-imports";
type ImportRow = { rowNumber: number; cells: Record<string, string | null>; errors: { field: string; message: string }[] };
type Preview = { importId: string; status: "READY" | "CONFIRMED"; expiresAt: string; totalRows: number; validRows: number; invalidRows: number;
  importedRows: number; skippedRows: number; content: ImportRow[]; page: number; totalPages: number; totalElements: number };

function importMessage(error: unknown) {
  const messages: Record<string, string> = {
    IMPORT_FILE_TOO_LARGE: "File vượt giới hạn 5 MiB. Hãy chia thành các file nhỏ hơn.",
    IMPORT_INVALID_FILE: "File không phải .xlsx hợp lệ, bị hỏng hoặc có macro/liên kết ngoài. Hãy dùng template Learnova.",
    IMPORT_INVALID_TEMPLATE: "Sheet Questions hoặc header chưa đúng. Hãy tải template và giữ nguyên tên, thứ tự các cột.",
    IMPORT_RESOURCE_LIMIT: "File vượt giới hạn xử lý an toàn. Hãy dùng template và chia nhỏ dữ liệu.",
    IMPORT_TOO_MANY_ROWS: "File có hơn 1.000 câu hỏi. Hãy chia thành các file nhỏ hơn.",
    IMPORT_EMPTY_FILE: "Sheet Questions chưa có câu hỏi. Hãy điền dữ liệu từ dòng 2.",
    IMPORT_EXPIRED: "Preview đã hết hạn sau 24 giờ. Hãy upload lại file để kiểm tra trước khi import.",
    IMPORT_NO_VALID_ROWS: "Không có dòng hợp lệ để import. Hãy sửa file và upload lại.",
    IMPORT_HAS_INVALID_ROWS: "File có dòng lỗi. Hãy sửa file hoặc chọn rõ chỉ import dòng hợp lệ.",
    IMPORT_NOT_FOUND: "Không tìm thấy lô import của bạn.",
  };
  if (error instanceof ApiError) return messages[error.problem?.code ?? ""] ?? (error.status === 413 ? messages.IMPORT_FILE_TOO_LARGE : error.message);
  return error instanceof Error ? error.message : "Chưa thể hoàn tất. Hãy thử lại.";
}
function Failure({ text, id }: { text: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, [text]);
  return <div id={id} ref={ref} tabIndex={-1} role="alert" className="rounded-lg border border-danger p-4 text-danger">{text}</div>;
}
export function QuestionImport() {
  const params = useSearchParams();
  const id = params.get("importId");
  return <div className="space-y-6"><p className="max-w-3xl text-muted-foreground">Tải template, điền câu hỏi rồi xem trước dữ liệu. Chỉ khi bạn xác nhận, các dòng hợp lệ mới được tạo thành bản nháp để rà soát và kích hoạt.</p>
    {id ? <ImportPreview key={id} id={id} /> : <ImportUpload />}</div>;
}
function ImportUpload() {
  const { session } = useAuth(); const router = useRouter();
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function download() {
    setBusy("download"); setError(""); controller.current = new AbortController();
    try {
      const blob = await session.api.request<Blob>(`${root}/template`, { responseType: "blob", signal: controller.current.signal });
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = "learnova-questions.xlsx"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { if (!controller.current.signal.aborted) setError(importMessage(cause)); }
    finally { setBusy(""); }
  }
  async function upload() {
    setError("");
    if (!file || !file.name.toLowerCase().endsWith(".xlsx") || file.size > 5 * 1024 * 1024 || file.size === 0) {
      setError("Chọn file .xlsx có dữ liệu, tối đa 5 MiB."); return;
    }
    setBusy("upload"); controller.current = new AbortController();
    const formData = new FormData(); formData.append("file", file);
    try {
      const preview = await session.api.request<Preview>(root, { method: "POST", formData, signal: controller.current.signal });
      router.push(`/creator/questions/import?importId=${preview.importId}`);
    } catch (cause) { if (!controller.current.signal.aborted) setError(importMessage(cause)); }
    finally { setBusy(""); }
  }
  return <section className={`${panel} max-w-3xl space-y-5`} aria-labelledby="upload-heading">
    <h2 id="upload-heading" className="text-xl font-bold">1. Chuẩn bị và tải file</h2>
    <p id="file-help">Tối đa 5 MiB và 1.000 câu hỏi. Sheet Questions dùng chung cho bốn loại câu hỏi; xem ví dụ trong sheet Instructions. Preview có hiệu lực 24 giờ.</p>
    <Button variant="secondary" disabled={!!busy} onClick={() => void download()}>{busy === "download" ? "Đang tải template…" : "Tải template .xlsx"}</Button>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void upload(); }}>
      <label htmlFor="import-file" className="block font-semibold">File câu hỏi (.xlsx)</label>
      <input id="import-file" type="file" accept=".xlsx" className={control} disabled={!!busy} aria-describedby={error ? "file-help import-file-error" : "file-help"} aria-invalid={!!error} onChange={event => { setFile(event.target.files?.[0] ?? null); setError(""); }} />
      {error && <Failure id="import-file-error" text={error} />}
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={!!busy}>{busy === "upload" ? "Đang phân tích và kiểm tra…" : "Upload và xem trước"}</Button><LinkButton variant="ghost" href="/creator/questions">Hủy</LinkButton></div>
      {busy === "upload" && <p role="status">Đang kiểm tra từng dòng. Chưa có câu hỏi nào được tạo.</p>}
    </form>
  </section>;
}
function ImportPreview({ id }: { id: string }) {
  const { session } = useAuth();
  const [page, setPage] = useState(0); const [filter, setFilter] = useState("ALL");
  const query = useQuestion<Preview>(`${root}/${encodeURIComponent(id)}?page=${page}&filter=${filter}`);
  const [completed, setCompleted] = useState<Preview | null>(null);
  const [validOnly, setValidOnly] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [needsCheck, setNeedsCheck] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function check(signal: AbortSignal) {
    const latest = await session.api.request<Preview>(`${root}/${encodeURIComponent(id)}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) });
    if (latest.status === "CONFIRMED") setCompleted(latest);
    setNeedsCheck(false); query.reload();
  }
  async function confirm() {
    setBusy(true); setError(""); controller.current = new AbortController();
    try {
      if (needsCheck) { await check(controller.current.signal); return; }
      setCompleted(await session.api.request<Preview>(`${root}/${encodeURIComponent(id)}/confirm`, { method: "POST", json: { validRowsOnly: validOnly }, signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(30000)]) }));
    } catch (cause) {
      if (controller.current.signal.aborted) return;
      setError(importMessage(cause)); setNeedsCheck(true);
      try { await check(controller.current.signal); } catch { /* Chỉ cho retry confirm sau khi đọc lại trạng thái server. */ }
    } finally { setBusy(false); }
  }
  const data = completed ?? query.data;
  if (!data) return <div className="space-y-4">{query.error ? <><Failure text={importMessage(query.error)} /><Button onClick={query.reload}>Thử lại</Button></> : <Skeleton />}<LinkButton variant="secondary" href="/creator/questions/import">Upload file khác</LinkButton><LinkButton variant="ghost" href="/creator/questions">Hủy</LinkButton></div>;
  if (data.status === "CONFIRMED") return <section className={`${panel} space-y-4`}><h2 className="text-xl font-bold text-success">Import thành công</h2>
    <p role="status">Đã tạo {data.importedRows} câu hỏi DRAFT; bỏ qua {data.skippedRows} dòng lỗi. Hãy rà soát và kích hoạt trước khi sử dụng.</p>
    <div className="flex flex-wrap gap-3"><LinkButton href="/creator/questions?status=DRAFT">Xem câu hỏi nháp</LinkButton><LinkButton variant="secondary" href="/creator/questions/import">Import file khác</LinkButton></div></section>;
  return <div className="space-y-5">
    <section className={`${panel} space-y-4`} aria-labelledby="preview-heading"><h2 id="preview-heading" className="text-xl font-bold">2. Kiểm tra trước khi import</h2>
      <p className="font-semibold">Tổng: {data.totalRows} · Hợp lệ: {data.validRows} · Lỗi: {data.invalidRows}</p>
      <p>Hạn xác nhận: {new Date(data.expiresAt).toLocaleString("vi-VN")}. Chưa có câu hỏi nào được tạo.</p>
      <label className="block max-w-sm space-y-2">Hiển thị dòng<select className={control} value={filter} disabled={busy} onChange={event => { setFilter(event.target.value); setPage(0); }}><option value="ALL">Tất cả</option><option value="VALID">Hợp lệ</option><option value="INVALID">Có lỗi</option></select></label>
      <p className="text-sm text-muted-foreground">Mở nội dung để kiểm tra đáp án. Nếu cần sửa, cập nhật file Excel rồi upload lại.</p>
      <ul className="divide-y divide-border" aria-label="Các dòng xem trước">{data.content.map(row => <li key={row.rowNumber} className="space-y-2 py-4">
        <div className="flex flex-wrap gap-3 font-semibold"><span>Dòng {row.rowNumber}</span><span>{typeLabels[row.cells.type as keyof typeof typeLabels] ?? row.cells.type ?? "Chưa có loại"}</span><span className={row.errors.length ? "text-danger" : "text-success"}>{row.errors.length ? "Có lỗi" : "Hợp lệ"}</span></div>
        <p className="whitespace-pre-wrap break-words">{row.cells.content?.slice(0, 240) ?? "Chưa có nội dung"}</p>
        {row.errors.length > 0 && <ul className="space-y-1 text-danger">{row.errors.map((issue, i) => <li key={i}>{issue.field}: {issue.message}</li>)}</ul>}
        <details><summary className="cursor-pointer py-2 font-semibold text-primary">Xem nội dung và đáp án dòng {row.rowNumber}</summary><dl className="space-y-3 rounded-lg bg-background p-3">{Object.entries(row.cells).filter(([, value]) => value !== null).map(([name, value]) => <div key={name}><dt className="font-semibold">{name}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}</dl></details>
      </li>)}</ul>
      {data.content.length === 0 && <p>Không có dòng phù hợp bộ lọc.</p>}
      <div className="flex flex-wrap items-center gap-3"><Button variant="secondary" disabled={busy || page === 0} onClick={() => setPage(n => n - 1)}>Trang trước</Button><span>Trang {page + 1}/{Math.max(1, data.totalPages)}</span><Button variant="secondary" disabled={busy || page + 1 >= data.totalPages} onClick={() => setPage(n => n + 1)}>Trang sau</Button></div>
    </section>
    <section className={`${panel} space-y-4`} aria-labelledby="confirm-heading"><h2 id="confirm-heading" className="text-xl font-bold">3. Xác nhận tạo câu hỏi nháp</h2>
      {data.invalidRows > 0 && <><p className="text-warning">File có {data.invalidRows} dòng lỗi. Sửa file và upload lại, hoặc chọn rõ chỉ nhập dòng hợp lệ.</p>
        {data.validRows > 0 && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 shrink-0" checked={validOnly} disabled={busy} onChange={event => setValidOnly(event.target.checked)} />Chỉ import {data.validRows} dòng hợp lệ, bỏ qua {data.invalidRows} dòng lỗi</label>}</>}
      {data.validRows === 0 && <p>Không có dòng hợp lệ. Hãy sửa file và upload lại.</p>}
      {error && <Failure text={error} />}
      <div className="flex flex-wrap gap-3"><Button disabled={busy || (!needsCheck && (data.validRows === 0 || (data.invalidRows > 0 && !validOnly)))} onClick={() => void confirm()}>{busy ? "Đang kiểm tra và xác nhận…" : needsCheck ? "Kiểm tra trạng thái import" : `Xác nhận import ${data.validRows} câu hỏi`}</Button>
        {!busy && <><LinkButton variant="secondary" href="/creator/questions/import">Upload file khác</LinkButton><LinkButton variant="ghost" href="/creator/questions">Hủy</LinkButton></>}
      </div>{busy && <p role="status">Đang chờ xác nhận từ server…</p>}
    </section>
  </div>;
}
