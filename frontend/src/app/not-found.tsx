import { LinkButton } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="sr-only">Không tìm thấy trang</h1>
      <PageState kind="not-found" action={<LinkButton href="/">Về trang chủ</LinkButton>} />
    </main>
  );
}
