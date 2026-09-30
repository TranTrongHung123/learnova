import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { CreatorClassroomDetail } from "@/features/classroom/creator-detail";
export default async function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return <ProtectedWorkspace workspace="CREATOR" title="Chi tiết lớp học"><CreatorClassroomDetail classId={classId} /></ProtectedWorkspace>;
}
