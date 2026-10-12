# Hoàn thiện chức năng và giao diện V1

Ngày kiểm tra: 08–09/10/2026. Phạm vi là chức năng và trải nghiệm sử dụng;
không bao gồm deploy theo yêu cầu đã làm rõ của người dùng.

## Thay đổi

- Gỡ `/dev/workspace-preview`, dữ liệu minh họa và cơ chế đổi link sang preview.
  Route này trả 404 trong cả development và bản build. Gỡ component placeholder
  và nhãn “Sắp có”; các route nghiệp vụ hiện có dùng API thật.
- Trang chủ giới thiệu quy trình và dẫn tới đăng ký, đăng nhập, workspace.
  Không dùng số liệu hoặc màn hình nghiệp vụ giả để trang trí.
- Auth có bố cục hai cột trên desktop, một cột trên mobile. Google Login chỉ hiện
  khi backend bật; kiểm tra config thất bại vẫn có retry. Không thay đổi auth strategy.
- Đồng bộ panel, button, navigation và ba dashboard theo theme sáng xanh dương;
  làm rõ quick actions, số liệu, empty state; giữ dữ liệu và result policy từ backend.
- Trạng thái bài thi chờ kết thúc dùng `pending`, không dùng thông báo feature
  chưa hoàn thiện. Không thay đổi deadline, autosave hoặc grading.
- Thay test preview bằng test trang thật. Bổ sung nghiệm thu xuyên module với
  PostgreSQL/Redis thật, kiểm tra form auth và keyboard drawer trên màn hình nhỏ.
  Bổ sung suite Admin vào CI; chưa chạy CI remote trong đợt này.

Không thêm dependency ứng dụng, migration hoặc thay đổi HTTP API contract.
Các sửa đổi có sẵn của người dùng trong `.env.example`, `README.md` và
`backend/src/main/resources/application.yaml` được giữ ngoài commit này.

## Kiểm chứng

| Lệnh / phạm vi | Kết quả |
|---|---|
| Backend `mvnw.cmd -B verify` | 207 tests pass; gồm PostgreSQL/Redis, migration và invariant nghiệp vụ |
| Frontend `npm run test:e2e` | 5 tests pass; entry points, preview 404, layout 375/768/1024/1440px |
| Frontend `npm run test:dashboard` | 5 tests pass; dữ liệu thật, policy, role switch, drawer keyboard, retry |
| Frontend `npm run test:admin` | 4 tests pass; role, lock/unlock, audit, isolation |
| Frontend `npm run test:google` | 5 tests pass với OIDC provider kiểm thử local |
| Frontend integration | 59 trường hợp đã đạt qua các lượt chạy; lượt đầy đủ bị ngắt sau test 50, nhóm còn lại và discovery chạy lại đạt 16/16 |
| Frontend `npm run lint`, `npm run typecheck`, `npm run build` | Đạt |
| Frontend `npm test` | 105 tests pass |
| Frontend `npm run test:production` | 1 test pass; bản build local không cung cấp preview/fixture, không deploy |

Bài nghiệm thu `tests/acceptance/lifecycle.spec.ts` bao phủ tạo lớp → join → upload
Excel → preview → confirm → kích hoạt câu hỏi → build/publish đề → schedule CLASS →
làm bài qua UI → autosave → reload → submit → giữ kín kết quả → release → analytics
→ download Excel. Các request đều đi qua HTTP API thật; không mock phản hồi nghiệp vụ.

Đã review ảnh trang chủ, đăng nhập và dashboard ở desktop/mobile. Các suite khác
kiểm tra responsive, dialog/focus, reduced motion, offline/retry, PUBLIC/INDIVIDUAL,
stable shuffle, reconnect và giữ kín kết quả. Bài test chờ refresh khi mở lớp đã tăng
thời hạn chờ request đầu tiên từ 5 lên 20 giây để bao gồm thời gian khởi tạo trang;
vẫn chặn request thật và kiểm tra trạng thái loading trước khi cho tiếp tục.
Test discovery chờ URL và heading của trang chi tiết trước khi kiểm tra nút bắt đầu;
tránh đọc nút của danh sách cũ khi navigation chưa hoàn tất. Đã chạy lại cùng suite
session để kiểm chứng khi database có nhiều kỳ thi PUBLIC.

## Giới hạn

Kết quả là kiểm chứng local trên Windows, Edge, Java 21, PostgreSQL 17 và Redis 7.4.
Chưa kiểm chứng Safari/iOS thật, screen reader thật, Google OAuth với credential thật
hoặc tải đồng thời quy mô lớn. Không xem kết quả này là cam kết không còn mọi lỗi.

Tài liệu thiết kế local đã đồng bộ tại `design-system/learnova/MASTER.md`,
`docs/requirements/screen-flow.md` và `docs/architecture/f21-functional-polish.md`.
