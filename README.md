# Learnova

Online Assessment & Examination Platform

## Cấu trúc backend

Backend tổ chức theo business module; bên trong mỗi module nhóm class theo trách nhiệm
(`controller`, `dto`, `service`, `entity`, `repository`, `security`, `config`, `exception`,
`enums`) khi có code thực tế. Khi thêm class, đọc
[quy ước package backend](docs/architecture/backend-package-structure.md); không gom
các loại class vào package gốc của module hoặc tạo technical layer chung toàn ứng dụng.

- [ ] Class mới nằm đúng module và package trách nhiệm; không tạo package rỗng.
- [ ] Chỉ mở quyền truy cập cần thiết; không dùng repository/entity của module khác làm API.

## Tech Stack

### Backend
- Java 21
- Spring Boot
- PostgreSQL
- Flyway
- Spring Security

### Frontend
- Next.js
- TypeScript
- Tailwind CSS

### Infrastructure
- Docker
- Docker Compose

## Chạy local (F01–F09)

Yêu cầu Java 21, Node.js 22 + npm và Docker Desktop đang chạy Linux containers.
Backend dùng Maven Wrapper; PostgreSQL 17 và Redis 7.4 chạy qua Compose.
Frontend có design system, workspace shell, Local/Google authentication, profile, Classroom,
Question Bank, Excel Import và Exam Builder/versioning.
Đăng ký tại `/register`, đăng nhập tại `/login`; multi-role có thể đổi workspace.
Creator quản lý lớp tại `/creator/classes`; Participant xem lớp và tham gia bằng mã
tại `/participant/classes`. Mã tham gia mặc định có hiệu lực 7 ngày.
Các tính năng nghiệp vụ chưa triển khai giữ trạng thái chưa sẵn sàng, không có mock fallback.
Sau `npm run dev`, mở [preview workspace](http://localhost:3000/dev/workspace-preview)
để kiểm tra shell, tập role và các trạng thái UI. Preview trả 404 ở production.

Từ root repository, chỉ tạo file local nếu chưa có:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
```

Thay placeholder `POSTGRES_PASSWORD` trong `.env` bằng mật khẩu local.
F03 yêu cầu `JWT_SECRET` là base64 của ít nhất 32 random bytes. Đoạn sau chạy được
trên Windows PowerShell 5.1 và PowerShell 7:

```powershell
$jwtSecretBytes = New-Object byte[] 32
$jwtSecretGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $jwtSecretGenerator.GetBytes($jwtSecretBytes) }
finally { $jwtSecretGenerator.Dispose() }
[Convert]::ToBase64String($jwtSecretBytes)
```

Lưu kết quả trong `.env` local, không commit hoặc chia sẻ output. Nếu `.env` đã tồn tại,
thêm biến auth từ `.env.example`, không ghi đè giá trị database hiện có.
Local dùng `AUTH_COOKIE_SECURE=false`, `AUTH_ALLOWED_ORIGINS=http://localhost:3000`.
Production dùng HTTPS cùng site, `AUTH_COOKIE_SECURE=true` và allowlist frontend chính xác.
Không commit `.env` hoặc `.env.local`. Redis local mặc định không đặt mật khẩu;
nếu đặt `REDIS_PASSWORD`, Compose và backend phải dùng cùng giá trị.
Cả hai cổng database/cache chỉ bind `127.0.0.1`.

```powershell
docker compose up -d --wait
docker compose ps
```

Compose tự đọc `.env`; Java chạy từ Maven hoặc IDE **không tự đọc** file này.
Trong terminal PowerShell chạy backend, nạp biến bằng đoạn sau (giá trị được đọc
như text, không thực thi nội dung `.env`; dùng mỗi dòng `KEY=value`, không inline comment):

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $configKey = $Matches[1]
        $configValue = $Matches[2].Trim()
        if ($configValue.Length -ge 2 -and (
            ($configValue.StartsWith('"') -and $configValue.EndsWith('"')) -or
            ($configValue.StartsWith("'") -and $configValue.EndsWith("'")))) {
            $configValue = $configValue.Substring(1, $configValue.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($configKey, $configValue, 'Process')
    }
}
Set-Location backend
.\mvnw.cmd spring-boot:run
```

Nếu chạy qua IDE, cấu hình cùng biến ở Run Configuration. Các biến backend:
`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`;
`REDIS_HOST=localhost`, `REDIS_PORT=6379`, `REDIS_PASSWORD=` và `SERVER_PORT=8080` có mặc định.
Auth dùng `JWT_SECRET` bắt buộc, `JWT_ISSUER=learnova`, `AUTH_COOKIE_SECURE=true`
và `AUTH_ALLOWED_ORIGINS=http://localhost:3000` mặc định.

Trong terminal khác:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Mở [frontend local](http://localhost:3000). Kiểm tra backend:

```powershell
Invoke-RestMethod http://localhost:8080/api/v1/health
```

Kết quả là `{"status":"UP"}`. Đây là liveness HTTP, không phải readiness của
PostgreSQL/Redis. Actuator không expose HTTP; request anonymous đến `/actuator/**`
hoặc URL chưa được mở trả 401 ProblemDetail, không redirect login. F01 không có
user/password mặc định và không mở quyền ADMIN cho Actuator.

## Schema, API và audit

- Flyway chạy migration khi backend khởi động; Hibernate chỉ `validate` schema.
- Không sửa migration đã áp dụng. F01 tạo `audit_records`; F03 thêm users, user_roles và auth_identities.
- `baseline-on-migrate=false`: database không rỗng nhưng thiếu Flyway history sẽ bị từ chối.
  Với database có sẵn, backup và kiểm tra schema trước; chỉ baseline thủ công ở version 0
  nếu schema chưa chứa đối tượng của V1. Nếu đã có bảng tương ứng, cần đối soát riêng,
  không bật auto-baseline để bỏ qua lỗi. Không xóa volume để xử lý lỗi trên dữ liệu cần giữ.
- [OpenAPI](docs/api/openapi.yaml) định nghĩa health, auth, ProblemDetail và pagination.
- [Authentication F03](docs/architecture/f03-local-authentication.md) mô tả JWT, refresh rotation,
  CSRF/CORS, workspace resolution và giới hạn vận hành.
- [Google Authentication F04](docs/architecture/f04-google-authentication.md) mô tả OAuth,
  onboarding, link account và phục hồi khi callback/network lỗi.
- [Profile và bảo mật F05](docs/architecture/f05-profile-security.md) mô tả sửa hồ sơ,
  đổi mật khẩu, thu hồi phiên và giới hạn transaction PostgreSQL–Redis.
- [Classroom và membership F06](docs/architecture/f06-classroom-membership.md) mô tả
  ownership, mã tham gia, concurrency và bảo toàn lịch sử membership.
- [Question Bank F07](docs/architecture/f07-question-bank.md) mô tả bốn loại câu hỏi,
  validation DRAFT/ACTIVE, restore, numeric precision và chống ghi đè đồng thời.
  Creator truy cập `/creator/questions`; câu hỏi private theo owner, plain text.
  Chạy browser integration bằng `npm run test:question` trong `frontend` với Docker.
- [Nền tảng F01](docs/architecture/f01-platform-foundation.md) mô tả security boundary,
  cách dùng pagination và ghi audit cùng transaction nghiệp vụ.

## Google Login

Tạo OAuth client loại **Web application** trong Google Cloud, cấu hình consent screen
và test users nếu ứng dụng còn ở chế độ testing. Đăng ký chính xác redirect URI backend:
`http://localhost:8080/api/v1/auth/google/callback` khi chạy local. Frontend callback
`/auth/google/callback` chỉ xử lý kết quả Learnova, không phải redirect URI đăng ký với Google.

Đặt biến môi trường backend theo `.env.example`:

```text
GOOGLE_AUTH_ENABLED=true
GOOGLE_CLIENT_ID=<OAuth client ID>
GOOGLE_CLIENT_SECRET=<OAuth client secret>
GOOGLE_REDIRECT_URI=http://localhost:8080/api/v1/auth/google/callback
GOOGLE_FRONTEND_URL=http://localhost:3000
```

Nạp chúng cùng các biến database/JWT theo hướng dẫn khởi động backend ở trên.
Giữ secret ngoài Git và ngoài mọi biến `NEXT_PUBLIC_*`. Production dùng HTTPS,
`AUTH_COOKIE_SECURE=true`, CORS allowlist và frontend/backend cùng site theo kiến trúc F03.
Không cấu hình deployment cross-site với cookie SameSite=Lax rồi kỳ vọng browser gửi cookie.
Mặc định Google Login tắt; UI thông báo chưa cấu hình và Local Login vẫn dùng được.

User Google mới chọn role trước khi nhận session. Email trùng Local account cần mật khẩu
và xác nhận link riêng. Nếu flow hết hạn/lỗi sau commit, đăng nhập Google lại để tiếp tục.
Google thật cần kiểm chứng thủ công với OAuth client của bạn; provider trong test không
chứng minh consent screen hoặc HTTPS deployment đã hoạt động.

## Kiểm chứng

Docker phải chạy để backend tests tự tạo PostgreSQL 17 và Redis riêng bằng Testcontainers;
không cần `.env` hoặc database local cho tests. Không bỏ qua integration test khi Docker lỗi.

```powershell
# Trong backend/
.\mvnw.cmd -B verify

# Trong frontend/
npm ci
npm run lint
npm test
npm run typecheck
npm run test:e2e
npm run test:auth
npm run test:google
npm run test:classroom
npm run test:question
npm run test:import
npm run test:exam
npm run build
npm run test:production
# Khi backend local đã chạy:
npm run test:health
```

Linux/macOS dùng `./mvnw` thay `mvnw.cmd`. CI chạy Java 21, Node 22; health smoke là lệnh local riêng.
Browser test local mặc định dùng Microsoft Edge đã cài. CI dùng Chromium và cài qua
`npx playwright install --with-deps chromium`. Test khởi động server ở cổng 3102/3103;
production test yêu cầu build trước. Health test đọc `NEXT_PUBLIC_API_URL` từ process
environment, mặc định localhost:8080; không tự nạp `.env.local`.
Build frontend hiện tải font qua `next/font/google`, cần truy cập mạng.
Auth browser test tự chạy backend ở 8081 và frontend ở 3104 cùng Testcontainers riêng;
không cần đọc `.env` hoặc dùng database của bạn. Tắt server ở cổng này để tạo môi trường mới.
Classroom, Question Bank, Excel Import và Exam Builder browser test dùng cùng cấu hình cổng với auth; chạy các suite tuần tự.
Question Bank trên CI (`CI=true npm run test:question`) tự build và chạy production server;
local mặc định vẫn dùng dev server. Khi suite lỗi, CI lưu JSON chẩn đoán route, số form,
textarea và lỗi JavaScript trong artifact `question-page-diagnostics` (giữ 7 ngày).
Google browser test dùng backend 8082, frontend 3105 và OIDC provider test 8092;
provider chỉ tồn tại trong test classpath, không dùng OAuth credentials thật.
Không ghi trace auth chứa password/token; ảnh form rỗng nằm trong test-results.
Nếu Docker báo thiếu named pipe, khởi động Docker Desktop và chờ Linux engine sẵn sàng.
Nếu cổng đã dùng, đổi port trong `.env` trước khi chạy Compose/backend.

`docker compose stop` dừng dependency và giữ dữ liệu. `docker compose down` gỡ container
nhưng giữ named volume; không dùng `down -v` nếu cần giữ dữ liệu.

## Import câu hỏi Excel (F08)

Creator mở **Ngân hàng câu hỏi → Import Excel**, tải template `.xlsx`, điền sheet `Questions`
và upload để xem trước. Sheet `Instructions` có hướng dẫn và ví dụ cho cả bốn loại câu hỏi;
dữ liệu ví dụ không được import. Giữ nguyên tên/thứ tự header và không thêm sheet khác.

- Tối đa **5 MiB/file, 1.000 câu hỏi**, preview có hiệu lực **24 giờ** theo thời gian server.
- `tags` phân cách bằng `;`; `correctOptions` dùng chỉ số lựa chọn như `1;3`.
  Các lựa chọn điền liên tục từ `option1`; `correctBoolean` dùng `TRUE` hoặc `FALSE`.
- Giữ cột đáp án số ở định dạng **Text**, dùng dấu chấm thập phân để Excel không làm tròn.
  Chấp nhận tối đa 20 chữ số nguyên và 10 chữ số thập phân; tolerance mặc định 0.
- Không dùng công thức, macro hoặc liên kết ngoài. Nội dung/đáp án phải đầy đủ và hợp lệ,
  nhưng sau confirm câu hỏi được tạo ở trạng thái **DRAFT** để Creator rà soát và kích hoạt.
- Upload chưa tạo Question. Xem tổng số dòng, dòng hợp lệ/lỗi, lý do và đáp án trước khi confirm.
  Nếu có lỗi, sửa file rồi upload lại hoặc chủ động chọn **chỉ import dòng hợp lệ**.
- Reload URL có `importId` để tiếp tục preview. Hết hạn thì upload lại; mỗi upload là một lô độc lập,
  không tự khử trùng nội dung hoặc cập nhật câu hỏi cũ. Confirm lại cùng lô không tạo câu hỏi trùng.
- Hủy/quay lại không tạo Question. Job mỗi phút dọn tối đa 100 payload hết hạn, giữ metadata,
  summary đã confirm và audit; không xóa Question. Không lưu file Excel gốc lâu dài.

API dưới `/api/v1/question-imports`; chi tiết tại [OpenAPI](docs/api/openapi.yaml).
Kiến trúc, giới hạn parser và kiểm thử: [F08 Excel Import](docs/architecture/f08-excel-import.md).

## Exam Builder và versioning (F09)

Creator mở **Đề thi** tại `/creator/exams`, tạo Exam và Draft v1, chọn các câu ACTIVE
của mình rồi cấu hình thứ tự/điểm. Thêm câu sao chép snapshot riêng; thay đổi Question Bank
không cập nhật nội dung Draft hoặc Published. Mỗi câu mặc định 1 điểm và phải có điểm >0.
Có thể chia đều tổng điểm; backend luôn tính tổng từ points của từng câu.

**Lưu bản nháp → Xuất bản** cố định nội dung và ghi audit cùng transaction. Published chỉ
có thể xem hoặc sao chép thành Draft mới. Một Exam có nhiều Draft, version number không trùng.
Archive giữ lịch sử và chỉ ngăn tạo Session mới, vẫn cho phép biên soạn/publish.
Sinh đề theo ma trận và tổ chức kỳ thi thuộc F10/F11, chưa khả dụng trong F09.

Chi tiết API, transaction và kiểm chứng: [F09 Exam Builder](docs/architecture/f09-exam-builder-versioning.md).

## Quy trình Git cho feature

- Trước khi sửa code feature mới, kiểm tra working tree và branch hiện tại; không tự bỏ hoặc ghi đè thay đổi đang có.
- Fetch `origin`, tạo và chuyển sang nhánh `feat/<feature-id>-<slug>` từ `origin/main` đã cập nhật, ví dụ `feat/f03-local-authentication`.
- Nếu đang ở đúng nhánh của feature đang làm, tiếp tục trên nhánh đó; không tạo nhánh trùng.
- Không triển khai hoặc commit feature trực tiếp trên `main`.
- Hoàn thành feature bằng kiểm thử phù hợp và Conventional Commit local. Người dùng tự push nhánh, mở pull request vào `main` và merge. Agent không tự thực hiện các thao tác GitHub này nếu chưa có yêu cầu rõ ràng mới.
- `AGENTS.md` local cũng ghi quy tắc này nhưng đang bị Git ignore; README và Definition of Done là bản được lưu trên GitHub.

## UI/UX workflow

Learnova dùng **UI/UX Pro Max** để thiết kế, triển khai và review giao diện theo từng feature trên Next.js App Router và Tailwind CSS.

- [Workflow UI/UX](docs/architecture/ui-ux-workflow.md): cách dùng skill, design system và checklist nghiệm thu.
- [Screen Flow](docs/requirements/screen-flow.md): màn hình, route và business state.
- [Kế hoạch V1](docs/plans/v1-feature-implementation-plan.md): thứ tự triển khai F01–F21.
- [Design system Master](design-system/learnova/MASTER.md): token, typography, layout và interaction.
- [Kiến trúc F02](docs/architecture/f02-frontend-foundation.md): shell, API client, điểm tích hợp F03 và kết quả kiểm chứng.

Skill nằm tại [.agents/skills/ui-ux-pro-max/SKILL.md](.agents/skills/ui-ux-pro-max/SKILL.md). Python 3 chỉ cần cho công cụ tra cứu local, không phải dependency chạy ứng dụng.


## F11 — Exam Session

Creator quản lý kỳ thi tại `/creator/sessions`, gồm wizard tạo nháp, giao PUBLIC/CLASS/INDIVIDUAL,
Schedule, Cancel và gia hạn. Schedule trong cửa sổ thi mở ngay; OPEN chỉ sửa tên và gia hạn,
khóa result policy. Related Sessions tích hợp ở Exam và Classroom.

Migration V9 bổ sung Session/assignment. Scheduler mặc định 10 giây, cấu hình bằng
`learnova.session.lifecycle-delay-ms`; request vẫn kiểm tra server time nếu job trễ.
Xem [kiến trúc F11](docs/architecture/f11-exam-session.md) và [OpenAPI](docs/api/openapi.yaml).
Browser suite: `cd frontend` rồi `npm run test:session` (PostgreSQL/Redis Testcontainers).
F13 sử dụng contract khóa/transaction F11 cho Start HTTP và bảo toàn deadline persisted.

## F12 — Participant exam discovery

Participant xem kỳ thi tại `/participant/exams`: Có thể làm, Sắp diễn ra, Đã hoàn thành
và Đã đóng. Các tab có thể giao nhau; tab/page giữ trong URL. Danh sách và chi tiết dùng
API thật, backend lọc quyền PUBLIC/CLASS/INDIVIDUAL và phân trang. PUBLIC vẫn yêu cầu
tài khoản ACTIVE có role PARTICIPANT.

Chi tiết hiển thị lịch thi, số câu, điểm cấu hình, số lượt và lịch sử metadata bài làm.
Mất membership không mất lịch sử hoặc khả năng tiếp tục bài còn hạn; không cấp Start mới
từ membership đã remove. Không gửi câu hỏi/đáp án, điểm bài làm hoặc pass/fail qua discovery.

Migration V10 bổ sung nền metadata Attempt và constraint bảo toàn lịch sử. F13 đã mở
Start/Continue bằng API thật; F15 đã nối lịch sử với màn hình kết quả theo policy.
Không có mock fallback. Xem [kiến trúc F12](docs/architecture/f12-participant-exam-discovery.md)
và [OpenAPI](docs/api/openapi.yaml).

Browser suite: `cd frontend` rồi `npm run test:discovery`; dùng PostgreSQL/Redis Testcontainers,
fixture chỉ thuộc test classpath và không được đóng gói production.

Kiểm chứng local ngày 04/10/2026: 144 backend tests, 66 frontend unit tests,
3 Discovery/4 Session/6 Classroom/1 production browser tests pass; lint/typecheck/build pass.
Chưa kiểm chứng CI remote, screen reader hoặc tải production.

## F13 — Start, resume, stable shuffle và autosave

Participant bắt đầu/tiếp tục từ discovery và làm bài tại `/participant/attempts/[attemptId]`.
Backend khóa Session để chống duplicate/vượt lượt, lưu deadline và thứ tự question/option
cụ thể. Migration V11 thêm answer/review/revision từng câu và telemetry, giữ snapshot bất biến.
Remove membership không làm mất quyền tiếp tục bài đang làm còn hạn.

Autosave tuần tự hóa/coalesce theo câu, chỉ báo Saved sau xác nhận; hỗ trợ retry hữu hạn,
đối chiếu hai tab và giữ input chưa lưu khi mất mạng. Không lưu answer vào browser storage.
Timer dùng serverTime/deadline; F14 đã bổ sung submit, auto-finalize và grading
trên nền F13. Kết quả theo release/display policy được triển khai ở F15.

Xem [kiến trúc F13](docs/architecture/f13-attempt-autosave.md),
[OpenAPI](docs/api/openapi.yaml) và [kết quả nghiệm thu](docs/plans/v1-feature-implementation-plan.md).
Browser suite: `cd frontend` rồi `npm run test:attempt`, dùng backend/PostgreSQL/Redis thật.


## F14 — Submit, auto-finalize và automatic grading

Participant xác nhận nộp bài sau khi autosave được backend xác nhận. Backend dùng một
transaction và khóa Attempt chung cho submit/expiration/save; Result và chi tiết từng
câu chỉ được lưu một lần. Scheduler quét mỗi 10 giây (cấu hình
`learnova.attempt.finalization-delay-ms`), kết hợp lazy expiration khi đọc/save/submit.
Restart tự xử lý backlog từ PostgreSQL; lỗi một bài không chặn bài khác.

Bốn loại câu hỏi chấm theo published snapshot bằng BigDecimal; pass/fail dùng raw score,
format điểm hai chữ số HALF_UP. Metadata giữ completionReason và thời điểm kết thúc/chấm.
UI F14 xác nhận đã nộp/hết giờ; F15 thêm đường dẫn xem kết quả theo policy.

API mới: `POST /api/v1/attempts/{id}/submit` (không gửi answers). Migration V12 bổ sung
Result, chi tiết và completion metadata. Xem [kiến trúc F14](docs/architecture/f14-submit-finalize-grading.md)
và [OpenAPI](docs/api/openapi.yaml). Browser suite: `npm run test:attempt` trong frontend.

## F15 — Result visibility, history và best score

Participant xem `/participant/results` và kết quả từng lượt theo display mode/release
policy do backend quyết định. HIDDEN luôn ẩn điểm; SUMMARY không có đáp án, DETAILED
đọc snapshot đúng phiên bản đã làm. BEST_SCORE chỉ dùng lượt GRADED, tính trước pagination.

Creator xem `/creator/sessions/[sessionId]/results`, mọi lượt của từng Participant và
công bố MANUAL có xác nhận. V13 lưu resultsReleasedAt; retry/concurrency không ghi
audit trùng, lỗi audit rollback công bố. Gia hạn dời mốc AFTER_SESSION_END.

Browser suite: `npm run test:result` trong frontend. Chi tiết và sơ đồ tại
[kiến trúc F15](docs/architecture/f15-result-visibility-history.md); kiểm chứng và giới hạn
tại [kế hoạch V1](docs/plans/v1-feature-implementation-plan.md).

Kiểm chứng local ngày 05/10/2026: 167 backend tests, 88 frontend unit tests và
16 browser tests (8 Attempt/3 Discovery/4 Session/1 production) pass; lint/typecheck/build pass.
Chưa kiểm chứng CI remote, screen reader hoặc tải production. Bàn giao bằng commit local,
người dùng tự push/PR/merge.

## F16 — Realtime monitoring

Creator mở Giám sát từ sidebar hoặc Session để xem tiến độ lượt mới nhất, answered
count đã lưu, lastSeen và kết nối. Snapshot REST và WebSocket chỉ dành cho owner,
không gửi answers/score. Reconnect refetch và đối soát SYNC, DELTA có stream/sequence.
PUBLIC không có “Chưa bắt đầu”; CLASS/INDIVIDUAL hợp nhất assignment và lịch sử.

V14 thêm lastSeen; heartbeat 15 giây, mất liên lạc 45 giây chỉ đổi connection status.
Projection đọc dữ liệu đã commit mỗi 2 giây khi có người xem; monitoring scheduler
tách khỏi deadline scheduler. Đây là view tiến độ, không phải audit log mọi event.

Browser suite: `npm run test:monitoring`. Backend: `mvnw.cmd -B verify` (Windows) hoặc
`./mvnw -B verify`. Cấu hình origin như auth; production proxy cần hỗ trợ WSS/Upgrade.
Chi tiết protocol, sơ đồ và giới hạn tải tại
[kiến trúc F16](docs/architecture/f16-realtime-monitoring.md).

## F17 — Reporting, Question Analytics và Excel export

Creator mở **Thống kê kỳ thi** từ Session detail hoặc **Xem thống kê** từ Results.
Tổng quan lấy BEST_SCORE mỗi Participant; câu hỏi lấy mọi lượt GRADED với snapshot và
số mẫu telemetry rõ ràng. Completion giữ người từng làm dù đã rời lớp; PUBLIC không áp dụng.
Nút **Xuất Excel** ở Results/Analytics tải mọi lượt làm, không giới hạn trang hiện tại.

API owner-only: `GET /api/v1/exam-sessions/{id}/analytics` và `GET .../{id}/export`.
Không thêm migration/dependency. Chạy `mvnw.cmd -B verify` trong backend và
`npm run test:result` trong frontend để kiểm tra F15/F17 với PostgreSQL/Redis thật.
Chi tiết mẫu thống kê, định dạng Excel, UI và giới hạn:
[kiến trúc F17](docs/architecture/f17-reporting-analytics-export.md).

## F18 — In-app notifications

Notification được lưu trong PostgreSQL, owner-only, phân trang/count, read/read-all
idempotent; tích hợp EXAM_ASSIGNED, EXAM_REMINDER, RESULT_RELEASED và CLASS_JOINED.
Listener cùng transaction và unique key chống rollback sai/duplicate; job mặc định
30 giây (`learnova.notification.delay-ms`) đối soát reminder/result theo backend policy.
PUBLIC không broadcast assignment/reminder. UI `/notifications` và chuông dùng API thật.

Chạy backend `mvnw.cmd -B verify`; frontend `npm run test:notification` cho browser
integration. Contract và giới hạn tại [kiến trúc F18](docs/architecture/f18-in-app-notifications.md).
