import type { Metadata } from "next";
import { GoogleAuthFlow } from "@/features/auth/google-flow";

export const metadata: Metadata = { title: "Đăng nhập Google" };

export default function GoogleCallbackPage() {
  return <GoogleAuthFlow page="callback" />;
}
