import { Skeleton } from "@/components/ui/page-state";
import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ExamScreen } from "@/features/exam/exam-detail";

export default async function Page({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Chi tiết đề thi">
      <Suspense fallback={<Skeleton />}>
        <ExamScreen id={examId} />
      </Suspense>
    </ProtectedWorkspace>
  );
}
