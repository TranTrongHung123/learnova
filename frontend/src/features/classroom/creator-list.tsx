"use client";

import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageState } from "@/components/ui/page-state";
import { apiRoot, date, Pagination, panel, QueryState, useClassroomQuery } from "./shared";
import { codeLabels, type ClassroomSummary, type PageResult } from "./types";

export function CreatorClassrooms() {
  const [page, setPage] = useState(0);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const query = useClassroomQuery<PageResult<ClassroomSummary>>(`${apiRoot}?page=${page}&search=${encodeURIComponent(search)}`);
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><p className="text-muted-foreground">Quản lý lớp và những người tham gia của bạn.</p><LinkButton href="/creator/classes/new">Tạo lớp</LinkButton></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setSearch(input.trim()); setPage(0); }}>
      <div className="min-w-0 flex-1"><Input id="class-search" label="Tìm theo tên lớp" maxLength={200} value={input} onChange={(e) => setInput(e.target.value)} /></div><Button type="submit" variant="secondary">Tìm kiếm</Button></form>
    {!query.data ? <QueryState error={query.error} retry={query.reload} /> : <>
      {query.data.content.length === 0 ? <PageState kind="empty" title="Chưa có lớp phù hợp" description="Tạo lớp đầu tiên hoặc thay đổi từ khóa tìm kiếm." /> :
        <div className="grid gap-4 xl:grid-cols-2">{query.data.content.map((c) => <article key={c.id} className={`${panel} min-w-0 space-y-4`}>
          <h2 className="text-xl font-bold [overflow-wrap:anywhere]">{c.name}</h2><p className="whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">{c.description || "Chưa có mô tả."}</p>
          <div className="flex flex-wrap gap-3 text-sm"><span>{c.activeParticipants} thành viên đang tham gia</span><span className="rounded bg-muted px-2 py-1">{codeLabels[c.joinCodeStatus]}</span></div>
          <p className="text-sm text-muted-foreground">Cập nhật {date(c.updatedAt)}</p><LinkButton variant="secondary" href={`/creator/classes/${c.id}`}>Mở lớp<span className="sr-only"> {c.name}</span></LinkButton>
        </article>)}</div>}
      <Pagination result={query.data} onPage={setPage} />
    </>}
  </div>;
}
