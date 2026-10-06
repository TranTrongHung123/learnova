import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { AnalyticsScreen } from "@/features/reporting/analytics";

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ProtectedWorkspace workspace="CREATOR" title="Thống kê kỳ thi"><AnalyticsScreen id={sessionId} /></ProtectedWorkspace>;
}
