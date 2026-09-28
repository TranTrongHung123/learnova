import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
export const metadata = { title: "Không gian người tạo" };
export default function Page() {
  return <ProtectedWorkspace workspace="CREATOR" title="Không gian người tạo" />;
}
