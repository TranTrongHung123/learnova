import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { SessionScreen } from "@/features/session/session-detail";
export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ProtectedWorkspace workspace="CREATOR" title="Chi tiết kỳ thi"><Suspense><SessionScreen id={sessionId} /></Suspense></ProtectedWorkspace>;
}
