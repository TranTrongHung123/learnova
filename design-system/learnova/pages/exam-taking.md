# Exam Taking — F13–F14

Kế thừa [Master](../MASTER.md). Chỉ override layout làm bài:

- Auth guard giữ PARTICIPANT và account hiện có; màn hình tập trung không sidebar/workspace switcher.
- Header không sticky để tránh che focus ở viewport thấp: tên bài, lượt, countdown tabular,
  trạng thái lưu tổng hợp và nút về kỳ thi. Không thông báo countdown mỗi giây qua live region.
- Desktop: câu hỏi chiếm phần chính, navigator 280px. Mobile: một cột, navigator có nút mở/đóng.
- Radio/checkbox có nhãn toàn hàng; numeric 16px, hint format và lỗi cạnh vùng nhập.
- Navigator dùng số, dấu tick, cờ và accessible name; current dùng aria-current, không chỉ màu.
- Một live region cho trạng thái lưu; từng câu có dirty/saving/saved/failed/conflict bằng chữ.
- Conflict hiển thị hai bản, hai action rõ ràng. Dialog Start/rời trang dùng native dialog,
  hỗ trợ Escape/focus return; không thoát Start khi request chưa xác nhận.
- Timer hết giờ khóa UI rồi đọc server; không tự tuyên bố đã nộp/chấm.
- Submit dùng native dialog: tóm tắt answered/unanswered/review, chờ save rồi submit.
  Khóa input và tránh đóng dialog khi request pending; trạng thái lưu/nộp/kiểm tra bằng chữ.
  Lỗi lưu/conflict cho quay lại xử lý; mất response đọc server trước khi retry.
- Hoàn tất: focus heading, phân biệt chủ động/hết giờ, nút về kỳ thi; không hiển thị điểm ở F14.
- Giữ touch target 44 CSS px, focus rõ, dialog cuộn ở viewport thấp; không đổi auth/client boundary.

Tra cứu UI/UX Pro Max: `form autosave feedback error` (ux), `client server components`
(nextjs), `responsive layout focus` (html-tailwind). Chọn hướng dẫn feedback/recovery,
Client boundary nhỏ và visible focus; không áp dụng server actions vì auth/API hiện có.

Review: 375/768/1024/1440px, landscape, zoom 200%, keyboard, reduced motion, semantic
colors từ Master. Câu hỏi và option dài phải wrap, không ép width hoặc cắt nội dung.

F14 tra cứu `keyboard focus confirmation dialog` (ux), `client interaction` (nextjs),
`responsive buttons` (html-tailwind). Giữ native dialog, client boundary hiện có và
semantic tokens; không áp dụng gợi ý thay đổi auth hoặc thư viện UI.
