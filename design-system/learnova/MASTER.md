# Learnova — Design system

F02, chốt ngày 26/09/2026. Áp dụng cho web Next.js App Router và Tailwind 4.

## Hướng thiết kế

Nền sáng, xanh dương, typography rõ và navigation ổn định. Giao diện mặc định tiếng Việt;
role/code giữ PARTICIPANT, CREATOR, ADMIN. User chọn light theme và preview development riêng.
Không triển khai dark mode ở F02. Không dùng màu làm tín hiệu trạng thái duy nhất.

Đã tra cứu UI/UX Pro Max: `assessment dashboard accessible` và một lần thu hẹp
`education SaaS workspace`; tra thêm `keyboard focus modal` (ux),
`client server components` (nextjs), `responsive layout` (html-tailwind).
Hai kết quả design-system vẫn đề xuất Hero/CTA landing page, không phù hợp shell.
Không persist nguyên kết quả đó. Master này tổng hợp thủ công phần phù hợp:
palette xanh, tính rõ ràng, font Plus Jakarta Sans và hướng dẫn keyboard/responsive.
Không áp dụng glassmorphism, heading monospace, native pt/dp hoặc choreography.

## Typography và layout

- Plus Jakarta Sans qua `next/font/google`, subsets latin/vietnamese; fallback Arial, sans-serif.
- Body 16px / line-height 1.6; nhãn phụ 12–14px; page heading 30px; heading section 20px.
- Weight 400 cho body, 600 cho label/action, 700 cho heading, 800 cho wordmark.
- Spacing 4/8/12/16/24/32/40px; radius 8px cho control, 12px cho surface.
- Sidebar 256px ở viewport >=1024px; cuộn dọc độc lập khi màn hình thấp.
- Dưới 1024px: drawer bằng native modal dialog, topbar giữ nút navigation và user menu.
- Topbar tối thiểu 80px, được wrap theo nội dung; content max-width 1280px.
- Gutter 16px mobile, 24px tablet, 32px desktop. Không cắt action để ép vừa layout.
- Nội dung dài được wrap; không dùng word-break: break-all. Body/input không nhỏ hơn 16px.

## Semantic tokens

Nguồn code: `frontend/src/app/globals.css`; CSS variables ánh xạ bằng `@theme inline`.

| Token | Giá trị | Vai trò |
|---|---|---|
| background | #F8FAFC | Nền trang |
| surface | #FFFFFF | Header, sidebar, card, dialog |
| foreground | #1E293B | Chữ chính |
| muted-foreground | #475569 | Chữ phụ, mục chưa sẵn sàng |
| primary / ring | #2563EB | Primary action, active navigation, focus |
| primary-hover | #1D4ED8 | Hover primary |
| on-primary | #FFFFFF | Chữ trên primary |
| muted | #EFF6FF | Active/background nhẹ |
| border | #E2E8F0 | Divider trang trí |
| control-border | #64748B | Ranh giới input/select/button |
| danger | #B91C1C | Lỗi |
| success | #15803D | Thành công được xác nhận |
| warning | #92400E | Cảnh báo |
| scrim | #0F172A80 | Backdrop drawer |

Contrast đã tính từ RGB: chữ/nền 13.98:1; chữ phụ/trắng 7.58:1; trắng/primary
5.17:1; primary/muted 4.75:1; control-border/trắng 4.76:1; danger/trắng
6.47:1; success/trắng 5.02:1; warning/trắng 7.09:1.
Border trang trí không dùng làm ranh giới duy nhất cho control.

## Component và interaction

- Button primary/secondary/ghost, LinkButton cho navigation. Hit area chính >=44 CSS px.
- Input có label, hint, error liên kết `aria-describedby`; `aria-invalid` khi lỗi.
- Badge có chữ rõ; Skeleton có status text cho screen reader, không giả nội dung.
- PageState: loading, empty, validation, forbidden, not-found, network/error,
  unavailable. Chưa triển khai feature không đồng nghĩa API trả danh sách rỗng.
- Navigation hiện tại có `aria-current`; mục tương lai disabled và nhãn “Sắp có”.
- Workspace switcher native select chỉ hiện khi có hơn một role tương ứng.
- User menu là disclosure chứa button/link, không gắn ARIA menu khi chưa dùng menu keyboard pattern.
- Drawer native `showModal()`: trap focus, Escape, trả focus về nút mở; đóng khi chọn route hoặc chuyển desktop.
- Focus outline 3px, offset 3px; skip link tới main. Icon trang trí có `aria-hidden`.
- Icon dùng Lucide duy nhất; wordmark Learnova đi cùng biểu tượng mũ tốt nghiệp.
- Motion chỉ đổi màu 150ms; token normal 200ms dự phòng. Reduced motion tắt transition/animation.

## Ranh giới và nghiệm thu

Master không thay đổi auth/API/business rules. Fixture chỉ ở route preview development,
không gán role/tạo token thật. Backend quyết định quyền và business state.
Không cần override ở F02 vì ba workspace dùng cùng shell. Feature có layout đặc thù
(Exam Taking/Monitoring) tạo override khi triển khai và đã xác định khác biệt thật.

Review mỗi feature: keyboard/focus, 375/768/1024/1440px, viewport thấp/landscape,
browser zoom, contrast, reduced motion, trạng thái API và không có mock fallback.
