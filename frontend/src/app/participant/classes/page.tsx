import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ParticipantClassrooms } from "@/features/classroom/participant-list";

export default function Page() {
  return (
    <ProtectedWorkspace workspace="PARTICIPANT" title="Lớp học của tôi">
      <ParticipantClassrooms />
    </ProtectedWorkspace>
  );
}
