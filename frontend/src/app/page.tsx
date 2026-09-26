import { ArrowRight, GraduationCap } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function Home() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16"
    >
      <div className="flex items-center gap-3 text-xl font-bold">
        <GraduationCap className="text-primary" aria-hidden="true" />
        Learnova
      </div>
      <div>
        <p className="mb-4 text-sm font-semibold text-primary">
          KHÔNG GIAN KIỂM TRA TRỰC TUYẾN
        </p>
        <h1 className="text-4xl leading-tight font-bold sm:text-5xl">
          Một nơi để tổ chức thi.
          <br />
          Một trải nghiệm rõ ràng.
        </h1>
      </div>
      <p className="max-w-xl text-lg text-muted-foreground">
        Learnova đang được hoàn thiện. Các tính năng tài khoản, tạo đề và tham
        gia kỳ thi sẽ sớm có mặt.
      </p>
      <div className="flex flex-wrap gap-3">
        <LinkButton href="/login">
          Thông tin đăng nhập <ArrowRight size={18} aria-hidden="true" />
        </LinkButton>
        {process.env.NODE_ENV === "development" && (
          <LinkButton variant="secondary" href="/dev/workspace-preview">
            Xem trước giao diện
          </LinkButton>
        )}
      </div>
    </main>
  );
}
