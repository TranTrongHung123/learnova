import { Skeleton } from "@/components/ui/page-state";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { UserList } from "@/features/admin/user-list";

export const metadata: Metadata = { title: "Quản lý người dùng" };

export default function Page() {
  return (
    <ProtectedWorkspace workspace="ADMIN" title="Quản lý người dùng">
      <Suspense fallback={<Skeleton />}>
        <UserList />
      </Suspense>
    </ProtectedWorkspace>
  );
}
