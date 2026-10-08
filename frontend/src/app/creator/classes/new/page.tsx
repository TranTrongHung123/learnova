import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ClassroomCreate } from "@/features/classroom/classroom-create";

export default function Page() {
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Tạo lớp học">
      <ClassroomCreate />
    </ProtectedWorkspace>
  );
}
