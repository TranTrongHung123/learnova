import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { Skeleton } from "@/components/ui/page-state";
import { DiscoveryDetail } from "@/features/discovery/discovery";

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return (
    <ProtectedWorkspace workspace="PARTICIPANT" title="Chi tiết kỳ thi">
      <Suspense fallback={<Skeleton />}>
        <DiscoveryDetail id={sessionId} />
      </Suspense>
    </ProtectedWorkspace>
  );
}
