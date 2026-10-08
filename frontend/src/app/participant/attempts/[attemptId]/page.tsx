import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ExamTaking } from "@/features/attempt/exam-taking";

export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return (
    <ProtectedWorkspace workspace="PARTICIPANT" title="Làm bài" focused>
      <ExamTaking key={attemptId} id={attemptId} />
    </ProtectedWorkspace>
  );
}
