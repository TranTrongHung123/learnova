import { Skeleton } from "@/components/ui/page-state";
export default function Loading() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-16">
      <Skeleton />
    </main>
  );
}
