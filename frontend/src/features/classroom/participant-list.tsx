"use client";

import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { apiRoot, Confirm, date, membershipImpact, Modal, Pagination, panel, QueryState, useClassroomQuery } from "./shared";
import type { JoinedClassroom, PageResult } from "./types";

export function ParticipantClassrooms() {
  const { session } = useAuth();
  const [page, setPage] = useState(0);
  const query = useClassroomQuery<PageResult<JoinedClassroom>>(`${apiRoot}/joined?page=${page}`);
  const [viewing, setViewing] = useState<JoinedClassroom>();
  const [leaving, setLeaving] = useState<JoinedClassroom>();
  const [notice, setNotice] = useState("");
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><p className="text-muted-foreground">Những lớp bạn đang tham gia.</p><LinkButton href="/participant/classes/join">Tham gia bằng mã</LinkButton></div>
    {notice && <p role="status" className="text-success">{notice}</p>}
    {!query.data ? <QueryState error={query.error} retry={query.reload} /> : <>
      {!query.data.content.length ? <PageState kind="empty" title="Bạn chưa tham gia lớp nào" description="Nhập mã do người tạo lớp cung cấp để bắt đầu." action={<LinkButton href="/participant/classes/join">Tham gia lớp</LinkButton>} /> :
        <div className="grid gap-4 xl:grid-cols-2">{query.data.content.map((c) => <article key={c.id} className={`${panel} min-w-0 space-y-4`}>
          <h2 className="text-xl font-bold [overflow-wrap:anywhere]">{c.name}</h2><p className="[overflow-wrap:anywhere]">Người tạo: {c.creatorName}</p><p className="text-sm text-muted-foreground">Tham gia lần đầu {date(c.joinedAt)}</p>
          <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => setViewing(c)}>Xem lớp<span className="sr-only"> {c.name}</span></Button><Button variant="ghost" onClick={() => setLeaving(c)}>Rời lớp<span className="sr-only"> {c.name}</span></Button></div>
        </article>)}</div>}
      <Pagination result={query.data} onPage={setPage} />
    </>}
    {viewing && <Modal title={viewing.name} onClose={() => setViewing(undefined)}><div className="space-y-4 [overflow-wrap:anywhere]"><p>Người tạo: {viewing.creatorName}</p><p className="whitespace-pre-wrap">{viewing.description || "Chưa có mô tả."}</p><p className="text-sm text-muted-foreground">Tham gia lần đầu {date(viewing.joinedAt)}</p></div></Modal>}
    {leaving && <Confirm title={`Rời lớp ${leaving.name}?`} description={membershipImpact} confirmLabel="Xác nhận rời lớp"
      action={() => session.api.request(`${apiRoot}/${leaving.id}/leave`, { method: "POST" })} onClose={() => setLeaving(undefined)} onDone={() => { setNotice("Đã rời lớp. Lịch sử bài làm và kết quả được giữ nguyên."); if (page > 0 && query.data?.content.length === 1) setPage(page - 1); else query.reload(); }} />}
  </div>;
}
