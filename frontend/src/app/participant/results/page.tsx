import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { ResultHistory } from "@/features/result/results";

export default async function Page() {
  return (
    <ProtectedWorkspace workspace="PARTICIPANT" title="Kết quả thi">
      <ResultHistory />
    </ProtectedWorkspace>
  );
}
