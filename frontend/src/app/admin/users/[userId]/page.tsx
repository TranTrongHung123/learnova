import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { UserDetail } from "@/features/admin/user-detail";

export const metadata = { title: "Chi tiết người dùng" };

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return (
    <ProtectedWorkspace workspace="ADMIN" title="Chi tiết người dùng">
      <UserDetail id={userId} />
    </ProtectedWorkspace>
  );
}
