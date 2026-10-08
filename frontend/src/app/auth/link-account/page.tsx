import { GoogleAuthFlow } from "@/features/auth/google-flow";

export const metadata = { title: "Liên kết tài khoản" };

export default function LinkAccountPage() {
  return <GoogleAuthFlow page="link" />;
}
