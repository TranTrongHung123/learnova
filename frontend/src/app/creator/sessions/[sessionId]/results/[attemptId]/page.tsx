import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ResultScreen } from "@/features/result/results";

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string; attemptId: string }>;
}) {
  const { sessionId, attemptId } = await params;
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Kết quả thi">
      <ResultScreen id={attemptId} sessionId={sessionId} />
    </ProtectedWorkspace>
  );
}
