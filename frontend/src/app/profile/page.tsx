import type { Metadata } from "next";
import { ProfileScreen } from "@/features/profile/profile-screen";

export const metadata: Metadata = { title: "Hồ sơ" };

export default function Page() {
  return <ProfileScreen />;
}
