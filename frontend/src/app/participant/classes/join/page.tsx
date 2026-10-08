import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { JoinClassroom } from "@/features/classroom/join-classroom";

export default function Page() {
  return (
    <ProtectedWorkspace workspace="PARTICIPANT" title="Tham gia lớp học">
      <JoinClassroom />
    </ProtectedWorkspace>
  );
}
