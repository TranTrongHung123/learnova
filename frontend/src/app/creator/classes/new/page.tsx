import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ClassroomForm } from "@/features/classroom/classroom-form";
export default function Page() {
  return <ProtectedWorkspace workspace="CREATOR" title="Tạo lớp học"><ClassroomForm /></ProtectedWorkspace>;
}
