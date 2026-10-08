import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ParticipantOverview } from "@/features/dashboard/participant";

export const metadata = { title: "Tổng quan người tham gia" };

export default function Page() {
  return (
    <ProtectedWorkspace workspace="PARTICIPANT" title="Tổng quan người tham gia">
      <ParticipantOverview />
    </ProtectedWorkspace>
  );
}
