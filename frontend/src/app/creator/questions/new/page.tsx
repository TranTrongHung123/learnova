import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { QuestionForm } from "@/features/question/question-form";
export default function Page() {
  return <ProtectedWorkspace workspace="CREATOR" title="Tạo câu hỏi"><QuestionForm /></ProtectedWorkspace>;
}
