import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { Monitoring } from "@/features/monitoring/monitoring";

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Giám sát kỳ thi">
      <Monitoring id={sessionId} />
    </ProtectedWorkspace>
  );
}
