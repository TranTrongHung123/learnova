import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { CreatorClassrooms } from "@/features/classroom/creator-list";
export default function Page() {
  return <ProtectedWorkspace workspace="CREATOR" title="Lớp học"><CreatorClassrooms /></ProtectedWorkspace>;
}
