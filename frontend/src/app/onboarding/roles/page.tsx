import type { Metadata } from "next";
import { GoogleAuthFlow } from "@/features/auth/google-flow";

export const metadata: Metadata = { title: "Chọn vai trò" };

export default function OnboardingPage() {
  return <GoogleAuthFlow page="roles" />;
}
