"use client";

import { useState } from "react";
import { useApiQuery } from "@/lib/api/use-query";
import { Button } from "@/components/ui/button";
import {
  difficultyLabels,
  typeLabels,
  type QuestionPage,
  type QuestionSummary,
} from "@/features/question/types";
import { control, Field, Modal, QueryState } from "./shared";

export function QuestionPicker({
  excluded,
  add,
  close,
  busy,
  error,
}: {
  excluded: string[];
  add: (questions: QuestionSummary[]) => void;
  close: () => void;
  busy: boolean;
  error: string;
}) {
  const [params, setParams] = useState("status=ACTIVE"),
    [selected, setSelected] = useState<Record<string, QuestionSummary>>({});
  const query = useApiQuery<QuestionPage>(`/api/v1/questions?${params}`);
  function page(n: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(n));
    setParams(next.toString());
  }
  return (
    <Modal title="Thêm từ ngân hàng câu hỏi" close={close} busy={busy}>
      <p className="mb-4 text-muted-foreground">
        Chỉ câu đang sử dụng của bạn. Nội dung được sao chép khi thêm; thay đổi ngân hàng sau đó
        không đổi bản nháp.
      </p>
      <form
        className="mb-5 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = new URLSearchParams({ status: "ACTIVE" });
          new FormData(e.currentTarget).forEach((v, k) => {
            if (String(v).trim()) next.set(k, String(v).trim());
          });
          setParams(next.toString());
        }}
      >
        <Field name="pick-keyword" label="Tìm nội dung">
          <input className={control} id="pick-keyword" name="keyword" maxLength={200} />
        </Field>
        <Field name="pick-type" label="Loại câu hỏi">
          <select className={control} id="pick-type" name="type">
            <option value="">Tất cả</option>
            {Object.entries(typeLabels).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field name="pick-difficulty" label="Độ khó">
          <select className={control} id="pick-difficulty" name="difficulty">
            <option value="">Tất cả</option>
            {Object.entries(difficultyLabels).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field name="pick-category" label="Danh mục">
          <input className={control} id="pick-category" name="category" maxLength={100} />
        </Field>
        <Field name="pick-tag" label="Nhãn / chủ đề">
          <input className={control} id="pick-tag" name="tag" maxLength={50} />
        </Field>
        <Button variant="secondary" type="submit" disabled={busy}>
          Lọc câu hỏi
        </Button>
      </form>
      {!query.data ? (
        <QueryState error={query.error} retry={query.reload} />
      ) : (
        <>
          {!query.data.content.length && (
            <p>
              Không có câu hỏi phù hợp. Hãy thay đổi bộ lọc hoặc kích hoạt câu hỏi trong ngân hàng.
            </p>
          )}
          <ul className="space-y-2">
            {query.data.content.map((q) => (
              <li key={q.id}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 [overflow-wrap:anywhere]">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0"
                    checked={!!selected[q.id] || excluded.includes(q.id)}
                    disabled={busy || excluded.includes(q.id)}
                    onChange={(e) =>
                      setSelected((current) => {
                        const next = { ...current };
                        if (e.target.checked) next[q.id] = q;
                        else delete next[q.id];
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">{q.contentPreview}</span>
                    <span className="text-sm text-muted-foreground">
                      {typeLabels[q.type]}
                      {excluded.includes(q.id) ? " · Đã có trong bản nháp" : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <nav aria-label="Phân trang câu hỏi" className="my-4 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              disabled={query.data.page === 0 || busy}
              onClick={() => page(query.data!.page - 1)}
            >
              Trang trước
            </Button>
            <span>
              Trang {query.data.page + 1}/{Math.max(1, query.data.totalPages)}
            </span>
            <Button
              variant="secondary"
              disabled={query.data.page + 1 >= query.data.totalPages || busy}
              onClick={() => page(query.data!.page + 1)}
            >
              Trang sau
            </Button>
          </nav>
        </>
      )}
      {error && (
        <p role="alert" className="my-4 text-danger">
          {error}
        </p>
      )}
      <p role="status" className="mb-3">
        Đã chọn {Object.keys(selected).length} câu
      </p>
      <Button
        disabled={busy || !Object.keys(selected).length}
        onClick={() => add(Object.values(selected))}
      >
        {busy ? "Đang thêm…" : "Thêm đã chọn"}
      </Button>
    </Modal>
  );
}
