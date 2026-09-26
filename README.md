# Learnova

Online Assessment & Examination Platform

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

## Chạy local (F01–F02)

Yêu cầu Java 21, Node.js 22 + npm và Docker Desktop đang chạy Linux containers.
Backend dùng Maven Wrapper; PostgreSQL 17 và Redis 7.4 chạy qua Compose.
Frontend đã có design system và workspace shell F02; authentication thuộc F03.
Route thật hiển thị trạng thái chưa sẵn sàng, không giả đăng nhập hoặc dữ liệu nghiệp vụ.
Sau `npm run dev`, mở [preview workspace](http://localhost:3000/dev/workspace-preview)
để kiểm tra shell, tập role và các trạng thái UI. Preview trả 404 ở production.

Từ root repository, chỉ tạo file local nếu chưa có:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
```

Thay placeholder `POSTGRES_PASSWORD` trong `.env` bằng mật khẩu local.
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
- Không sửa migration đã áp dụng. F01 tạo `audit_records`; schema nghiệp vụ bổ sung theo feature.
- `baseline-on-migrate=false`: database không rỗng nhưng thiếu Flyway history sẽ bị từ chối.
  Với database có sẵn, backup và kiểm tra schema trước; chỉ baseline thủ công ở version 0
  nếu schema chưa chứa đối tượng của V1. Nếu đã có bảng tương ứng, cần đối soát riêng,
  không bật auto-baseline để bỏ qua lỗi. Không xóa volume để xử lý lỗi trên dữ liệu cần giữ.
- [OpenAPI](docs/api/openapi.yaml) định nghĩa health, ProblemDetail và pagination.
- [Nền tảng F01](docs/architecture/f01-platform-foundation.md) mô tả security boundary,
  cách dùng pagination và ghi audit cùng transaction nghiệp vụ.

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
Nếu Docker báo thiếu named pipe, khởi động Docker Desktop và chờ Linux engine sẵn sàng.
Nếu cổng đã dùng, đổi port trong `.env` trước khi chạy Compose/backend.

`docker compose stop` dừng dependency và giữ dữ liệu. `docker compose down` gỡ container
nhưng giữ named volume; không dùng `down -v` nếu cần giữ dữ liệu.

## UI/UX workflow

Learnova dùng **UI/UX Pro Max** để thiết kế, triển khai và review giao diện theo từng feature trên Next.js App Router và Tailwind CSS.

- [Workflow UI/UX](docs/architecture/ui-ux-workflow.md): cách dùng skill, design system và checklist nghiệm thu.
- [Screen Flow](docs/requirements/screen-flow.md): màn hình, route và business state.
- [Kế hoạch V1](docs/plans/v1-feature-implementation-plan.md): thứ tự triển khai F01–F21.
- [Design system Master](design-system/learnova/MASTER.md): token, typography, layout và interaction.
- [Kiến trúc F02](docs/architecture/f02-frontend-foundation.md): shell, API client, điểm tích hợp F03 và kết quả kiểm chứng.

Skill nằm tại [.agents/skills/ui-ux-pro-max/SKILL.md](.agents/skills/ui-ux-pro-max/SKILL.md). Python 3 chỉ cần cho công cụ tra cứu local, không phải dependency chạy ứng dụng.
