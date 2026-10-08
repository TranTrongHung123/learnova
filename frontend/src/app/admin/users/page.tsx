import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { UserList } from "@/features/admin/user-list";

export const metadata = { title: "Quản lý người dùng" };

export default function Page() {
  return (
    <ProtectedWorkspace workspace="ADMIN" title="Quản lý người dùng">
      <Suspense>
        <UserList />
      </Suspense>
    </ProtectedWorkspace>
  );
}
