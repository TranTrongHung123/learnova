import { GoogleAuthFlow } from "@/features/auth/google-flow";

export const metadata = { title: "Đăng nhập Google" };

export default function GoogleCallbackPage() {
  return <GoogleAuthFlow page="callback" />;
}
