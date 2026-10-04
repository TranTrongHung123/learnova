"use client";
import { ApiError } from "@/lib/api/client";
export { Modal, panel, control, Field, QueryState } from "@/features/exam/shared";
export function message(cause: unknown) {
  if (cause instanceof ApiError) {
    const messages: Record<string, string> = {
      SESSION_CONFIG_LOCKED: "Kỳ thi đã mở hoặc đã có bài làm. Cấu hình đã bị khóa.",
      SESSION_INVALID_STATE: "Trạng thái kỳ thi không còn cho phép thao tác này. Hãy tải lại để đối chiếu.",
      SESSION_REVISION_CONFLICT: "Kỳ thi đã thay đổi. Nội dung đang nhập được giữ lại; hãy tải bản máy chủ để đối chiếu.",
      SESSION_USE_EXTEND_COMMAND: "Kỳ thi đã lên lịch chỉ được tăng giờ kết thúc qua Gia hạn.",
      SESSION_INVALID_PARTICIPANT: "Người nhận phải có tài khoản hoạt động và vai trò PARTICIPANT.",
      EXAM_ARCHIVED: "Đề đã lưu trữ, không thể dùng để tạo hoặc lên lịch kỳ thi mới.",
      EXAM_VERSION_NOT_PUBLISHED: "Hãy chọn phiên bản đã xuất bản.",
    };
    return messages[cause.problem?.code ?? ""] ?? cause.message;
  }
  return "Chưa xác nhận lưu thành công. Kiểm tra kết nối và dữ liệu trên máy chủ trước khi thử lại.";
}
export const date = (value: string) => {
  const instant = new Date(value);
  return `${instant.toLocaleDateString("vi-VN")} · ${instant.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}`;
};
