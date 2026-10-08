import { GoogleAuthFlow } from "@/features/auth/google-flow";

export const metadata = { title: "Chọn vai trò" };

export default function OnboardingPage() {
  return <GoogleAuthFlow page="roles" />;
}
