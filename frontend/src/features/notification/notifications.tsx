"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, ClipboardList, GraduationCap, Users } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useApiQuery } from "@/lib/api/use-query";
import { Button, LinkButton } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { Pagination } from "@/features/classroom/shared";
import { QueryState, panel, date, message } from "@/features/session/shared";
import { notificationTarget, type NotificationPage, type NotificationType, type UnreadCount } from "./types";

const changed = "learnova:notifications-changed";
const icons: Record<NotificationType, typeof Bell> = { EXAM_ASSIGNED: ClipboardList, EXAM_REMINDER: CalendarClock, RESULT_RELEASED: GraduationCap, CLASS_JOINED: Users };

export function NotificationBell() {
  const { session } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let controller: AbortController | undefined;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      const request = new AbortController(); controller = request;
      session.api.request<UnreadCount>("/api/v1/notifications/unread-count", { signal: request.signal }).then(
        data => { if (!request.signal.aborted) setCount(data.unreadCount); },
        () => { if (!request.signal.aborted) setCount(null); },
      );
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener(changed, refresh); window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller?.abort(); window.clearInterval(timer);
      window.removeEventListener(changed, refresh); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [session]);
  return <Link href="/notifications" className="flex min-h-11 items-center gap-2 rounded-lg px-3 hover:bg-muted" aria-label={count === null ? "Thông báo" : `Thông báo, ${count} chưa đọc`}>
    <Bell aria-hidden="true" size={21} />
    {count !== null && count > 0 && <span aria-hidden="true" className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-on-primary">{count > 99 ? "99+" : count}</span>}
  </Link>;
}

export function NotificationsScreen() {
  const { user } = useAuth();
  if (!user?.roles.some(role => role === "PARTICIPANT" || role === "CREATOR")) return <PageState kind="forbidden" />;
  return <NotificationList />;
}
function NotificationList() {
  const { session } = useAuth();
  const [page, setPage] = useState(0), [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const query = useApiQuery<NotificationPage>(`/api/v1/notifications?page=${page}&unreadOnly=${unreadOnly}`, true);
  const count = useApiQuery<UnreadCount>("/api/v1/notifications/unread-count", true);
  function reload() { query.reload(); count.reload(); window.dispatchEvent(new Event(changed)); }
  async function read(id?: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await session.api.request(id ? `/api/v1/notifications/${id}/read` : "/api/v1/notifications/read-all", { method: "POST" });
      setNotice(id ? "Đã đánh dấu thông báo đã đọc." : "Đã đánh dấu tất cả thông báo đã đọc.");
      // Về trang đầu để không mắc kẹt ở trang rỗng sau khi lọc chưa đọc.
      if (unreadOnly) setPage(0);
      reload();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <section className="space-y-5" aria-label="Danh sách thông báo">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground">Kỳ thi được giao, lịch nhắc thi, kết quả và lớp học của bạn.</p>
      <Button variant="secondary" disabled={busy} onClick={reload}>Làm mới</Button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={unreadOnly} disabled={busy} onChange={e => { setUnreadOnly(e.target.checked); setPage(0); }} className="size-5 accent-primary" />Chỉ chưa đọc</label>
      <Button variant="secondary" disabled={busy || !count.data?.unreadCount} onClick={() => void read()}>{busy ? "Đang cập nhật…" : "Đánh dấu tất cả đã đọc"}</Button>
    </div>
    <p role="status" aria-label="Trạng thái thông báo" aria-atomic="true" className="text-sm text-muted-foreground">{notice || (count.data ? `${count.data.unreadCount} thông báo chưa đọc` : count.error ? "Chưa tải được số thông báo chưa đọc. Hãy làm mới để thử lại." : "Đang tải số thông báo chưa đọc…")}</p>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {!query.data ? <QueryState error={query.error} retry={reload} /> : <>
      {!query.data.content.length && <PageState kind="empty" title={unreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo"} description="Thông báo mới sẽ xuất hiện khi có hoạt động liên quan đến bạn." />}
      <ul className="space-y-3">{query.data.content.map(item => {
        const Icon = icons[item.type] ?? Bell, target = notificationTarget(item);
        return <li key={item.id}><article className={`${panel} flex items-start gap-3 [overflow-wrap:anywhere]`}>
          <span className="rounded-lg bg-muted p-2 text-primary"><Icon size={22} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{item.title}</h2><span className={`text-sm ${item.readAt ? "text-muted-foreground" : "font-bold text-primary"}`}>{item.readAt ? "Đã đọc" : "Chưa đọc"}</span></div>
            <p>{item.message}</p><p className="text-sm text-muted-foreground"><time dateTime={item.createdAt}>{date(item.createdAt)}</time></p>
            <div className="flex flex-wrap gap-2">{target && <LinkButton variant="secondary" href={target}>Mở nội dung liên quan</LinkButton>}
              {!item.readAt && <Button variant="ghost" disabled={busy} onClick={() => void read(item.id)}>Đánh dấu đã đọc</Button>}</div>
          </div>
        </article></li>;
      })}</ul>
      <Pagination result={query.data} onPage={setPage} />
    </>}
  </section>;
}
