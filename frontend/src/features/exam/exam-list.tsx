"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useApiQuery } from "@/lib/api/use-query";
import { Button, LinkButton } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { control, Field, panel, QueryState } from "./shared";
import { examLabel, versionLabel, type ExamPage } from "./types";

export function ExamList() {
  const params = useSearchParams(),
    router = useRouter();
  const query = useApiQuery<ExamPage>(`/api/v1/exams?${params}`);
  function page(value: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(value));
    router.push(`/creator/exams?${next}`, { scroll: false });
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-muted-foreground">
          Biên soạn và quản lý các phiên bản đề thi
        </p>
        <LinkButton href="/creator/exams/new">Tạo đề thi</LinkButton>
      </div>
      <form
        key={params.toString()}
        className={`${panel} grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_auto] xl:items-end`}
        onSubmit={(e) => {
          e.preventDefault();
          const next = new URLSearchParams();
          new FormData(e.currentTarget).forEach((v, k) => {
            if (String(v).trim()) next.set(k, String(v).trim());
          });
          router.push(`/creator/exams?${next}`, { scroll: false });
        }}
      >
        <Field name="keyword" label="Tìm tên đề">
          <input
            className={control}
            id="keyword"
            name="keyword"
            maxLength={200}
            defaultValue={params.get("keyword") ?? ""}
          />
        </Field>
        <Field name="status" label="Trạng thái">
          <select
            className={control}
            id="status"
            name="status"
            defaultValue={params.get("status") ?? "ACTIVE"}
          >
            {Object.entries(examLabel).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" className="sm:col-span-2 xl:col-span-1">Áp dụng bộ lọc</Button>
      </form>
      {!query.data ? (
        <QueryState error={query.error} retry={query.reload} />
      ) : (
        <>
          {!query.data.content.length && (
            <PageState
              kind="empty"
              title="Chưa có đề thi phù hợp"
              description="Tạo đề đầu tiên hoặc thay đổi bộ lọc"
            />
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {query.data.content.map((e) => (
              <article key={e.id} className={`${panel} flex min-w-0 flex-col gap-3 [overflow-wrap:anywhere]`}>
                <h2 className="text-lg leading-7 font-semibold">{e.name}</h2>
                <p>
                  {examLabel[e.status]} · Phiên bản {e.latestVersion.versionNumber} —{" "}
                  {versionLabel[e.latestVersion.status]}
                </p>
                <p>
                  {e.latestVersion.questionCount} câu hỏi · {e.latestVersion.totalScore} điểm
                </p>
                <p className="text-sm text-muted-foreground">
                  Cập nhật: {new Date(e.updatedAt).toLocaleString("vi-VN")}
                </p>
                <LinkButton variant="secondary" className="mt-auto self-start" href={`/creator/exams/${e.id}`}>
                  Mở đề thi
                </LinkButton>
              </article>
            ))}
          </div>
          <nav
            aria-label="Phân trang"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p>
              {query.data.totalElements} đề thi · Trang {query.data.page + 1}/
              {Math.max(1, query.data.totalPages)}
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                disabled={query.data.page === 0}
                onClick={() => page(query.data!.page - 1)}
              >
                Trang trước
              </Button>
              <Button
                variant="secondary"
                disabled={query.data.page + 1 >= query.data.totalPages}
                onClick={() => page(query.data!.page + 1)}
              >
                Trang sau
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
