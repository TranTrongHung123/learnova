import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
export const metadata = { title: "Không gian người tham gia" };
export default function Page() {
  return <ProtectedWorkspace workspace="PARTICIPANT" title="Không gian người tham gia" />;
}
