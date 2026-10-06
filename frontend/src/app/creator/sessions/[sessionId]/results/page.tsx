import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { CreatorResults } from "@/features/result/results";
export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ProtectedWorkspace workspace="CREATOR" title="Kết quả thi"><CreatorResults id={sessionId} /></ProtectedWorkspace>;
}
