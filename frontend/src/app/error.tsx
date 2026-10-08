"use client";

import { Button, LinkButton } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="sr-only">Lỗi hiển thị</h1>
      <PageState
        kind="error"
        action={
          <div className="flex flex-wrap gap-3">
            <Button onClick={reset}>Thử lại</Button>
            <LinkButton variant="secondary" href="/">
              Về trang chủ
            </LinkButton>
          </div>
        }
      />
    </main>
  );
}
