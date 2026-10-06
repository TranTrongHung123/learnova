# Monitoring — override F16

Kế thừa Master. Không thay màu, font hoặc auth/business rule.

- Trang vận hành: Session title, connection status và “Đồng bộ lại” đứng trước summary.
- 5 summary cards: đã tham gia/tổng, chưa bắt đầu, đang làm, đã hoàn tất, mất kết nối.
  PUBLIC dùng “Không áp dụng” cho chưa bắt đầu. Số dùng tabular-nums.
- Bảng semantic roles, header ở desktop, rows thành nhóm dọc có nhãn trên mobile.
  Không bắt người dùng cuộn ngang để thấy lastSeen/connection. 25 rows mỗi trang,
  tìm theo displayName; không lấy focus khi cập nhật.
- Một status region cho kết nối; không đọc lại mọi row mỗi tick. Cảnh báo stale khi
  reconnect, giữ thời điểm cập nhật gần nhất. Có nút restart/retry bằng keyboard.
- Connection và Attempt state có chữ riêng. Không dùng màu để thay cho nhãn trạng thái.
  Progress chỉ tính answer đã persist, có accessible name cho từng Participant.
- Tra cứu skill: `live status updates` (ux), `client effects cleanup` (nextjs),
  `responsive table` (Tailwind, không có kết quả), retry `responsive layout` có hướng dẫn
  padding/responsive phù hợp. Dùng web CSS px và semantic tokens; không thêm thư viện UI.
