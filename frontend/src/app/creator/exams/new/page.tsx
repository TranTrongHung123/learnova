import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ExamCreate } from "@/features/exam/exam-create";

export default function Page() {
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Tạo đề thi">
      <Suspense>
        <ExamCreate />
      </Suspense>
    </ProtectedWorkspace>
  );
}
