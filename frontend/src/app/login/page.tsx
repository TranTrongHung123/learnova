import { AuthForm } from "@/features/auth/auth-form";
export const metadata = { title: "Đăng nhập" };
export default async function Page({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  return <AuthForm registered={params.registered === "1"} />;
}
