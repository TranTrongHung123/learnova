import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
export const metadata = { title: "Thông báo" };
export default function Page() {
  return <ProtectedWorkspace title="Thông báo" />;
}
