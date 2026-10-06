import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ResultScreen } from "@/features/result/results";
export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ProtectedWorkspace workspace="PARTICIPANT" title="Kết quả thi"><ResultScreen id={attemptId} /></ProtectedWorkspace>;
}
