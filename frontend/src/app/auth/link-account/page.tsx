import type { Metadata } from "next";
import { GoogleAuthFlow } from "@/features/auth/google-flow";

export const metadata: Metadata = { title: "Liên kết tài khoản" };

export default function LinkAccountPage() {
  return <GoogleAuthFlow page="link" />;
}
