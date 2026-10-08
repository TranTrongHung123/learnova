# Learnova

Nền tảng kiểm tra và thi trực tuyến: quản lý câu hỏi, tạo và version hóa đề thi,
tổ chức kỳ thi, làm bài với autosave, chấm điểm, công bố kết quả và thống kê.
Hỗ trợ ba workspace **PARTICIPANT**, **CREATOR**, **ADMIN**

## Features

- **Tài khoản:** đăng ký, đăng nhập local/Google, quản lý hồ sơ và chuyển workspace theo role.
- **Lớp học:** tạo lớp, tham gia bằng mã và quản lý thành viên.
- **Ngân hàng câu hỏi:** quản lý bốn loại câu hỏi; import Excel qua kiểm tra và xem trước.
- **Đề thi:** biên soạn, sinh đề theo ma trận, quản lý phiên bản và xuất bản snapshot bất biến.
- **Kỳ thi:** lên lịch, giao bài công khai, theo lớp hoặc từng Participant; quản lý lượt làm và thời gian thi.
- **Làm bài:** tìm kỳ thi, bắt đầu/tiếp tục bài, autosave và giữ thứ tự xáo trộn ổn định.
- **Chấm điểm và kết quả:** nộp bài, tự kết thúc khi hết giờ, chấm tự động; công bố theo policy,
  xem lịch sử và điểm cao nhất.
- **Giám sát và báo cáo:** theo dõi tiến độ realtime, thống kê kỳ thi/câu hỏi và xuất Excel.
- **Thông báo:** thông báo trong ứng dụng về giao bài, nhắc thi, kết quả và tham gia lớp.
- **Dashboard:** tổng quan và thao tác nhanh cho từng workspace.
- **Quản trị:** quản lý user, khóa/mở khóa tài khoản, quản lý role PARTICIPANT/CREATOR và tra cứu audit log.

## Công nghệ và cấu trúc

- **Backend:** Java 21, Spring Boot 4, Maven, Spring Security, JPA, Flyway, WebSocket.
- **Frontend:** Next.js 16, React, TypeScript, Tailwind CSS.
- **Dữ liệu:** PostgreSQL 17, Redis 7.4; chạy local bằng Docker Compose.

```text
backend/        Backend modular monolith, package theo feature
frontend/       Next.js App Router, UI theo feature
docs/api/       API contract
.github/        CI workflows
```

## Chạy local

Cần **Java 21**, **Node.js 22 + npm** và **Docker Desktop** chạy Linux containers.
Các lệnh dưới đây dùng PowerShell, bắt đầu tại root repository.

### 1. Cấu hình môi trường

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
```

Trong `.env`, thay `POSTGRES_PASSWORD` và `JWT_SECRET`. Tạo JWT secret bằng:

```powershell
$jwtSecretBytes = New-Object byte[] 32
$jwtSecretGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $jwtSecretGenerator.GetBytes($jwtSecretBytes) }
finally { $jwtSecretGenerator.Dispose() }
[Convert]::ToBase64String($jwtSecretBytes)
```

Lưu kết quả vào `JWT_SECRET`. Giữ `AUTH_COOKIE_SECURE=false` cho HTTP local.
Frontend mặc định gọi `http://localhost:8080` qua `NEXT_PUBLIC_API_URL`.

### 2. Khởi động PostgreSQL và Redis

```powershell
docker compose up -d --wait
```

### 3. Khởi động backend

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

### 4. Khởi động frontend

```powershell
Set-Location frontend
npm ci
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000), đăng ký tại `/register` hoặc đăng nhập tại `/login`.
Kiểm tra backend tại [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health):
phản hồi `{"status":"UP"}` là liveness HTTP.

Google Login mặc định tắt. Để bật, cấu hình `GOOGLE_*` trong [.env.example](.env.example)
và OAuth client loại Web application với redirect URI
`http://localhost:8080/api/v1/auth/google/callback`.


## Kiểm tra

```powershell
# Trong backend/
.\mvnw.cmd -B verify

# Trong frontend/
npm run lint
npm run typecheck
npm test
npm run build
```

Backend integration tests cần Docker để chạy PostgreSQL/Redis qua Testcontainers.
Các browser suite nằm trong [frontend/package.json](frontend/package.json),
cấu hình CI tại [.github/workflows/ci.yml](.github/workflows/ci.yml).


## Tài liệu

- [OpenAPI](docs/api/openapi.yaml)
