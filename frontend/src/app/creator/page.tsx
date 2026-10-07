import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { CreatorOverview } from "@/features/dashboard/creator";
export const metadata = { title: "Tổng quan người tạo" };
export default function Page() {
  return <ProtectedWorkspace workspace="CREATOR" title="Tổng quan người tạo"><CreatorOverview /></ProtectedWorkspace>;
}
