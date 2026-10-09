import { Skeleton } from "@/components/ui/page-state";
import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { SessionList } from "@/features/session/session-list";

export default function Page() {
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Báo cáo">
      <Suspense fallback={<Skeleton />}>
        <SessionList reporting />
      </Suspense>
    </ProtectedWorkspace>
  );
}
