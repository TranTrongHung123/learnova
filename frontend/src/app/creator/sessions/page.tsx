import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { SessionList } from "@/features/session/session-list";
export default function Page() {
  return <ProtectedWorkspace workspace="CREATOR" title="Kỳ thi"><Suspense><SessionList /></Suspense></ProtectedWorkspace>;
}
