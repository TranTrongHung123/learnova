import { ProtectedWorkspace } from "@/features/auth/protected-workspace";

export const metadata = { title: "Chọn không gian làm việc" };

export default function Page() {
  return <ProtectedWorkspace title="Chọn không gian làm việc" selection />;
}
