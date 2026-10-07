import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { AdminOverview } from "@/features/dashboard/admin";
export const metadata = { title: "Tổng quan quản trị" };
export default function Page() {
  return <ProtectedWorkspace workspace="ADMIN" title="Tổng quan quản trị"><AdminOverview /></ProtectedWorkspace>;
}
