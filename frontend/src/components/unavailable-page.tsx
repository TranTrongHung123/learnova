import { LinkButton } from "./ui/button";
import { PageState } from "./ui/page-state";
export function UnavailablePage({ title }: { title: string }) {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-3xl space-y-6 px-4 py-16 sm:px-6"
    >
      <p className="font-bold text-primary">Learnova</p>
      <h1 className="text-3xl font-bold">{title}</h1>
      <PageState
        kind="unavailable"
        action={<LinkButton href="/">Về trang chủ</LinkButton>}
      />
    </main>
  );
}
