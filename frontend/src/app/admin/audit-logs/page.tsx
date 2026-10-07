import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { AuditLog } from "@/features/admin/audit-log";
export const metadata = { title: "Nhật ký hoạt động" };
export default function Page() {
  return <ProtectedWorkspace workspace="ADMIN" title="Nhật ký hoạt động"><Suspense><AuditLog /></Suspense></ProtectedWorkspace>;
}
