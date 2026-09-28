import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
export const metadata = { title: "Không gian quản trị" };
export default function Page() {
  return <ProtectedWorkspace workspace="ADMIN" title="Không gian quản trị" />;
}
