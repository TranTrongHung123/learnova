import { Skeleton } from "@/components/ui/page-state";
import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ExamList } from "@/features/exam/exam-list";

export default function Page() {
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Đề thi">
      <Suspense fallback={<Skeleton />}>
        <ExamList />
      </Suspense>
    </ProtectedWorkspace>
  );
}
