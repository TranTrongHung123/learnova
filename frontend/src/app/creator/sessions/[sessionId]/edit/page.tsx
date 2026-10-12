import { Skeleton } from "@/components/ui/page-state";
import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { EditSession } from "@/features/session/session-form";

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Chỉnh sửa kỳ thi">
      <Suspense fallback={<Skeleton />}>
        <EditSession id={sessionId} />
      </Suspense>
    </ProtectedWorkspace>
  );
}
