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

## Chạy local (F01–F03)

Yêu cầu Java 21, Node.js 22 + npm và Docker Desktop đang chạy Linux containers.
Backend dùng Maven Wrapper; PostgreSQL 17 và Redis 7.4 chạy qua Compose.
Frontend có design system, workspace shell và Local authentication F03.
Đăng ký tại `/register`, đăng nhập tại `/login`; multi-role có thể đổi workspace.
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
Google browser test dùng backend 8082, frontend 3105 và OIDC provider test 8092;
provider chỉ tồn tại trong test classpath, không dùng OAuth credentials thật.
Không ghi trace auth chứa password/token; ảnh form rỗng nằm trong test-results.
Nếu Docker báo thiếu named pipe, khởi động Docker Desktop và chờ Linux engine sẵn sàng.
Nếu cổng đã dùng, đổi port trong `.env` trước khi chạy Compose/backend.

`docker compose stop` dừng dependency và giữ dữ liệu. `docker compose down` gỡ container
nhưng giữ named volume; không dùng `down -v` nếu cần giữ dữ liệu.

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
