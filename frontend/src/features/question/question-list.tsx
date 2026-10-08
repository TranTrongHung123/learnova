"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { apiRoot, control, Field, message, panel, QueryState, useQuestion } from "./shared";
import {
  difficultyLabels,
  statusLabels,
  typeLabels,
  type QuestionDetail,
  type QuestionPage,
  type QuestionSummary,
} from "./types";

export function QuestionList() {
  const params = useSearchParams();
  const router = useRouter();
  const query = useQuestion<QuestionPage>(`${apiRoot}?${params.toString()}`);
  const [notice, setNotice] = useState("");
  const completed = (question: QuestionDetail) => {
    setNotice(`Đã cập nhật: ${statusLabels[question.status]}.`);
    query.reload();
  };
  function page(number: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(number));
    router.push(`/creator/questions?${next}`);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-muted-foreground">
          Soạn và quản lý câu hỏi riêng của bạn. Chỉ câu đã kích hoạt mới có thể dùng cho đề mới.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/creator/questions/new">Tạo câu hỏi</LinkButton>
          <LinkButton variant="secondary" href="/creator/questions/import">
            Import Excel
          </LinkButton>
        </div>
      </div>
      <form
        key={params.toString()}
        className={`${panel} grid gap-4 sm:grid-cols-2 xl:grid-cols-3`}
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          new FormData(event.currentTarget).forEach((value, key) => {
            if (String(value).trim()) next.set(key, String(value).trim());
          });
          router.push(`/creator/questions?${next}`);
        }}
      >
        <Field name="keyword" label="Tìm nội dung">
          <input
            id="keyword"
            name="keyword"
            className={control}
            defaultValue={params.get("keyword") ?? ""}
            maxLength={200}
          />
        </Field>
        {[
          { name: "type", label: "Loại câu hỏi", values: typeLabels },
          { name: "difficulty", label: "Độ khó", values: difficultyLabels },
          { name: "status", label: "Trạng thái", values: statusLabels },
        ].map((filter) => (
          <Field key={filter.name} name={filter.name} label={filter.label}>
            <select
              id={filter.name}
              name={filter.name}
              className={control}
              defaultValue={params.get(filter.name) ?? ""}
            >
              <option value="">
                {filter.name === "status" ? "Nháp và đang sử dụng" : "Tất cả"}
              </option>
              {Object.entries(filter.values).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <Field name="category" label="Danh mục">
          <input
            id="category"
            name="category"
            className={control}
            maxLength={100}
            defaultValue={params.get("category") ?? ""}
          />
        </Field>
        <Field name="tag" label="Nhãn / chủ đề">
          <input
            id="tag"
            name="tag"
            className={control}
            maxLength={50}
            defaultValue={params.get("tag") ?? ""}
          />
        </Field>
        <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-3">
          <Button type="submit">Tìm kiếm / Lọc</Button>
          <LinkButton variant="ghost" href="/creator/questions">
            Xóa bộ lọc
          </LinkButton>
        </div>
      </form>
      {notice && (
        <p role="status" className="text-success">
          {notice}
        </p>
      )}
      {!query.data ? (
        <QueryState error={query.error} retry={query.reload} />
      ) : (
        <>
          {query.data.content.length === 0 ? (
            <PageState
              kind="empty"
              title="Chưa có câu hỏi phù hợp"
              description="Tạo câu hỏi đầu tiên hoặc thay đổi bộ lọc."
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <table className="w-full table-fixed border-collapse rounded-xl bg-surface text-left">
                  <caption className="sr-only">Câu hỏi của bạn</caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th className="w-2/5 p-4">Nội dung</th>
                      <th className="p-4">Phân loại</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.content.map((q) => (
                      <tr key={q.id} className="border-b border-border align-top">
                        <td className="p-4 [overflow-wrap:anywhere]">
                          <p className="font-semibold">{q.contentPreview || "Chưa có nội dung"}</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {q.category || "Chưa phân loại"} · {q.tags.join(", ")}
                          </p>
                        </td>
                        <td className="p-4">
                          {typeLabels[q.type]}
                          <p className="text-sm text-muted-foreground">
                            {q.difficulty ? difficultyLabels[q.difficulty] : "Chưa có độ khó"}
                          </p>
                        </td>
                        <td className="p-4">
                          {statusLabels[q.status]}
                          <p className="mt-2 text-sm text-muted-foreground">
                            {new Date(q.updatedAt).toLocaleDateString("vi-VN")}
                          </p>
                        </td>
                        <td className="p-4">
                          <Actions question={q} onDone={completed} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-4 lg:hidden">
                {query.data.content.map((q) => (
                  <article key={q.id} className={`${panel} space-y-3 [overflow-wrap:anywhere]`}>
                    <h2 className="font-bold">{q.contentPreview || "Chưa có nội dung"}</h2>
                    <p>
                      {typeLabels[q.type]} · {statusLabels[q.status]}
                    </p>
                    <p className="text-sm">
                      {q.difficulty ? difficultyLabels[q.difficulty] : "Chưa có độ khó"} ·{" "}
                      {q.category || "Chưa phân loại"}
                    </p>
                    <p className="text-sm">{q.tags.join(", ")}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(q.updatedAt).toLocaleDateString("vi-VN")}
                    </p>
                    <Actions question={q} onDone={completed} />
                  </article>
                ))}
              </div>
            </>
          )}
          <nav
            aria-label="Phân trang"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p>
              {query.data.totalElements} câu hỏi · Trang {query.data.page + 1}/
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

function Actions({
  question: q,
  onDone,
}: {
  question: QuestionSummary;
  onDone: (question: QuestionDetail) => void;
}) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change() {
    const action = q.status === "ARCHIVED" ? "restore" : "archive";
    if (
      action === "archive" &&
      !window.confirm("Lưu trữ câu hỏi? Câu hỏi sẽ không dùng cho đề mới; lịch sử được giữ nguyên.")
    )
      return;
    setBusy(true);
    setError("");
    try {
      onDone(
        await session.api.request<QuestionDetail>(`${apiRoot}/${q.id}/${action}`, {
          method: "POST",
          json: { revision: q.revision },
        }),
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <LinkButton variant="secondary" href={`/creator/questions/${q.id}`}>
          Xem
        </LinkButton>
        {q.status !== "ARCHIVED" && (
          <LinkButton variant="ghost" href={`/creator/questions/${q.id}/edit`}>
            Sửa
          </LinkButton>
        )}
        <Button variant="ghost" disabled={busy} onClick={() => void change()}>
          {busy ? "Đang xử lý…" : q.status === "ARCHIVED" ? "Khôi phục" : "Lưu trữ"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
