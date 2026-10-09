import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/features/auth/auth-provider";

import { WorkspaceLayout } from "@/features/auth/protected-workspace";

const sans = Plus_Jakarta_Sans({
  variable: "--font-learnova",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Learnova", template: "%s | Learnova" },
  description: "Nền tảng tổ chức và tham gia kiểm tra trực tuyến.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a className="skip-link" href="#main-content">
          Chuyển đến nội dung chính
        </a>
        <AuthProvider>
          <WorkspaceLayout>{children}</WorkspaceLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
