import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { SessionForm } from "@/features/session/session-form";

export default function Page() {
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Tạo kỳ thi">
      <Suspense>
        <SessionForm />
      </Suspense>
    </ProtectedWorkspace>
  );
}
