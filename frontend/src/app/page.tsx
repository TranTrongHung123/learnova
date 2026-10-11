import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardList,
  GraduationCap,
  Layers3,
  MoveUpRight,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { LinkButton } from "@/components/ui/button";

const steps = [
  {
    icon: BookOpen,
    title: "Chuẩn bị nội dung",
    description: "Xây dựng ngân hàng câu hỏi, nhập Excel và biên soạn đề theo từng phiên bản",
  },
  {
    icon: ClipboardList,
    title: "Tổ chức kỳ thi",
    description: "Giao bài theo lớp hoặc từng người, thiết lập thời gian và theo dõi bài làm",
  },
  {
    icon: Layers3,
    title: "Hiểu rõ kết quả",
    description: "Chấm điểm tự động, công bố kết quả và phân tích từng câu hỏi",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Learnova — Trang chủ"
            className="flex min-h-11 items-center gap-3 text-xl font-extrabold tracking-tight"
          >
            <span className="rounded-xl bg-primary p-2 text-on-primary">
              <GraduationCap size={26} aria-hidden="true" />
            </span>
            <span>
              Learnova<span className="text-primary">.</span>
            </span>
          </Link>
          <nav aria-label="Điều hướng chính" className="flex items-center gap-3">
            <a
              href="#how-it-works"
              className="hidden min-h-11 items-center px-3 text-sm font-semibold text-muted-foreground hover:text-primary sm:inline-flex"
            >
              Cách hoạt động
            </a>
            <LinkButton variant="secondary" href="/login">
              Đăng nhập <ArrowRight size={16} aria-hidden="true" />
            </LinkButton>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-bold tracking-wider text-primary">
              <GraduationCap size={16} aria-hidden="true" /> KHÔNG GIAN KIỂM TRA TRỰC TUYẾN
            </p>
            <h1 className="max-w-2xl text-4xl leading-[1.15] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Tổ chức thi gọn gàng
              <br />
              <span className="text-primary">Đánh giá hiệu quả</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
              Từ câu hỏi đầu tiên đến kết quả cuối cùng. Learnova kết nối người tạo đề và người
              tham gia trong một trải nghiệm liền mạch.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/register" className="px-6">
                Tạo tài khoản <ArrowRight size={18} aria-hidden="true" />
              </LinkButton>
              <LinkButton variant="ghost" href="/workspaces">
                Vào không gian của bạn <MoveUpRight size={16} aria-hidden="true" />
              </LinkButton>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Check size={17} className="text-success" aria-hidden="true" /> Một tài khoản,
              linh hoạt tạo đề và làm bài
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
            <div className="mb-7 flex items-center justify-between gap-4 border-b border-border pb-5">
              <h2 className="text-lg font-bold">Một quy trình, từ đầu đến cuối</h2>
              <Layers3 size={24} className="shrink-0 text-primary" aria-hidden="true" />
            </div>
            <ol className="space-y-7">
              {steps.map(({ icon: Icon, title, description }, index) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="mb-1 text-xs font-bold tracking-wider text-muted-foreground">
                      BƯỚC 0{index + 1}
                    </p>
                    <h3 className="font-bold">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section id="how-it-works" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <p className="text-xs font-bold tracking-wider text-primary">
              THIẾT KẾ CHO CẢ HAI VAI TRÒ
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight">
              Rõ ràng khi tổ chức
              <br />
              An tâm khi làm bài
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: BookOpen,
                  title: "Nội dung trong tầm tay",
                  text: "Quản lý câu hỏi, lớp học và đề thi tại cùng một nơi. Phiên bản đã xuất bản giữ nguyên nội dung bài kiểm tra.",
                },
                {
                  icon: ShieldCheck,
                  title: "Bài làm được tiếp nối",
                  text: "Câu trả lời được tự động lưu. Theo dõi trạng thái lưu và tiếp tục bài đang làm sau khi tải lại trang.",
                },
                {
                  icon: Radio,
                  title: "Theo dõi đúng thời điểm",
                  text: "Giám sát tiến độ làm bài, xem thống kê và chủ động chọn thời điểm công bố kết quả.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-border bg-background p-6"
                >
                  <Icon className="mb-5 text-primary" size={24} aria-hidden="true" />
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="mt-3 leading-7 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p className="font-bold text-foreground">Learnova</p>
        <p>Không gian dành cho việc đánh giá và tiến bộ</p>
      </footer>
    </div>
  );
}
