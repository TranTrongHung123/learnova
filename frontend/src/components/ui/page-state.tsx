import { CircleAlert, FileQuestion, LockKeyhole, Inbox, WifiOff, Construction } from "lucide-react";
import type { ReactNode } from "react";

export type PageStateKind =
  "empty" | "forbidden" | "not-found" | "network" | "unavailable" | "error";

const states = {
  empty: {
    icon: Inbox,
    title: "Chưa có nội dung",
    description: "Nội dung sẽ xuất hiện tại đây khi có dữ liệu.",
  },
  forbidden: {
    icon: LockKeyhole,
    title: "Bạn không có quyền truy cập",
    description: "Chọn không gian làm việc phù hợp với quyền của bạn.",
  },
  "not-found": {
    icon: FileQuestion,
    title: "Không tìm thấy trang",
    description: "Đường dẫn có thể không đúng hoặc trang không còn tồn tại.",
  },
  network: {
    icon: WifiOff,
    title: "Chưa thể kết nối",
    description: "Kiểm tra kết nối mạng rồi thử lại. Chưa có dữ liệu mới được tải.",
  },
  unavailable: {
    icon: Construction,
    title: "Tính năng đang được hoàn thiện",
    description: "Bạn có thể quay lại trang chủ trong khi chờ tính năng sẵn sàng.",
  },
  error: {
    icon: CircleAlert,
    title: "Không thể hiển thị nội dung",
    description: "Vui lòng thử lại hoặc quay về trang chủ.",
  },
};

export function PageState({
  kind,
  title,
  description,
  action,
}: {
  kind: PageStateKind;
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  const state = states[kind];
  const Icon = state.icon;
  return (
    <section className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-border bg-surface p-6 text-center sm:p-12">
      <div className="mb-5 rounded-xl bg-muted p-4">
        <Icon size={28} aria-hidden="true" className="text-primary" />
      </div>
      <h2 className="text-xl font-bold">{title ?? state.title}</h2>
      <p className="mt-3 max-w-md text-muted-foreground">{description ?? state.description}</p>
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}

export function Skeleton() {
  return (
    <div role="status" className="space-y-6 rounded-xl border border-border bg-surface p-8">
      <span className="sr-only">Đang tải nội dung</span>
      <div className="h-6 w-2/3 rounded bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-4 w-4/5 rounded bg-muted" />
      <div className="h-40 rounded bg-muted" />
    </div>
  );
}
