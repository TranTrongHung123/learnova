import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
export const metadata = { title: "Hồ sơ" };
export default function Page() {
  return <ProtectedWorkspace title="Hồ sơ" />;
}
