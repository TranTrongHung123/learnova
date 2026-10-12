import { Skeleton } from "@/components/ui/page-state";
import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { QuestionList } from "@/features/question/question-list";

export default function Page() {
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Ngân hàng câu hỏi">
      <Suspense fallback={<Skeleton />}>
        <QuestionList />
      </Suspense>
    </ProtectedWorkspace>
  );
}
