import { Suspense } from "react";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { VersionScreen } from "@/features/exam/version-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ examId: string; versionId: string }>;
}) {
  const { examId, versionId } = await params;
  return (
    <ProtectedWorkspace workspace="CREATOR" title="Soạn đề thi">
      <Suspense>
        <VersionScreen examId={examId} id={versionId} edit />
      </Suspense>
    </ProtectedWorkspace>
  );
}
