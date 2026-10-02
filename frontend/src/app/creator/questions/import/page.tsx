import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { QuestionImport } from "@/features/question/question-import";

export default function Page() {
  return <ProtectedWorkspace workspace="CREATOR" title="Import câu hỏi từ Excel"><Suspense><QuestionImport /></Suspense></ProtectedWorkspace>;
}
