import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { NotificationsScreen } from "@/features/notification/notifications";
export const metadata = { title: "Thông báo" };
export default function Page() {
  return <ProtectedWorkspace title="Thông báo"><NotificationsScreen /></ProtectedWorkspace>;
}
