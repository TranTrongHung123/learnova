import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { QuestionScreen } from "@/features/question/question-detail";
export default async function Page({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  return <ProtectedWorkspace workspace="CREATOR" title="Chi tiết câu hỏi"><Suspense><QuestionScreen id={questionId} /></Suspense></ProtectedWorkspace>;
}
