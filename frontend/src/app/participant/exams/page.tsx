import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { Skeleton } from "@/components/ui/page-state";
import { DiscoveryList } from "@/features/discovery/discovery";

export default function Page() {
  return (
    <ProtectedWorkspace workspace="PARTICIPANT" title="Kỳ thi của tôi">
      <Suspense fallback={<Skeleton />}>
        <DiscoveryList />
      </Suspense>
    </ProtectedWorkspace>
  );
}
