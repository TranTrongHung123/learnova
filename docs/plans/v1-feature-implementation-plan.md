# Learnova V1 — Kế hoạch triển khai theo từng feature

## 1. Hiện trạng và nguyên tắc triển khai

Nguồn đối chiếu:

- [Business Requirements](../requirements/business-requirements.md).
- [Use Cases](../requirements/use-cases.md).
- [Screen Flow](../requirements/screen-flow.md).
- [OpenAPI](../api/openapi.yaml).
- [Workflow UI/UX Pro Max](../architecture/ui-ux-workflow.md).
- Hướng dẫn `AGENTS.md` ở root, backend và frontend; source code, cấu hình, test và CI hiện có.

| Thành phần | Hiện trạng |
|---|---|
| Backend | Spring Boot 4.1.1, Java 21; có health, ProblemDetail, pagination và audit foundation |
| Database | PostgreSQL 17, Flyway V1–V13 gồm identity, audit, classroom/membership, Question Bank, import preview, Exam Version, Session/assignment, Attempt, answer/order, grading và manual result release; Hibernate validate schema |
| Authentication | Local/Google login, onboarding, link account, JWT, refresh rotation/reuse, logout-all và multi-role; Actuator vẫn đóng |
| Frontend | Workspace shell, auth/profile, Classroom, Question Bank, Excel Import, Exam Builder/Matrix, Session, discovery, Exam Taking/Submit và Results/history/manual release tích hợp API thật |
| Redis, WebSocket | Redis 7.4 lưu refresh session/hash, OAuth/pending flow và chạy Lua atomic; WebSocket chưa triển khai |
| OpenAPI | Health, auth/profile/password, Classroom, Questions, Question Imports, Exams, Exam Sessions, Participant discovery, Attempts và Results; 65 paths, lỗi và pagination dùng chung |
| Testing | F13: 155 backend, 82 unit frontend; browser 5 Attempt, 3 Discovery, 4 Session, 6 Classroom và 1 production pass local; các suite khác xem thời điểm kiểm chứng tại từng feature |
| CI | Java 21/Node 22/Chromium/Linux; F06 từng fail reload hai tab và bootstrap trước tạo lớp, các bản sửa bước chờ chưa kiểm chứng remote |
| Tài liệu | Requirements, screen flow, OpenAPI, README và sơ đồ kiến trúc đồng bộ qua F15 |

**F01–F02 đã hoàn thành và kiểm chứng local ngày 26/09/2026.** M0 hoàn thành.
**F03 đã triển khai, kiểm chứng local và CI ngày 28/09/2026**; đã push nhánh và mở
[PR #3](https://github.com/TranTrongHung123/learnova/pull/3). Khi bắt đầu F04, `origin/main`
đã có F03 tại commit `869c52c`.
**F04 đã triển khai và kiểm chứng local ngày 28/09/2026**; chưa kiểm chứng OAuth Google
thật/HTTPS hoặc CI remote. Người dùng tự push nhánh và mở PR.
**F05 đã triển khai và kiểm chứng local ngày 29/09/2026**; bàn giao bằng commit local.
**F06 đã triển khai và kiểm chứng local ngày 30/09/2026**; bàn giao bằng commit local.
**F07 đã triển khai và kiểm chứng local ngày 01/10/2026**; bàn giao bằng commit local.
**F08 đã triển khai và kiểm chứng local ngày 02/10/2026**; bàn giao bằng commit local.
F09–F10 đã triển khai; kết quả và giới hạn kiểm chứng được ghi tại từng feature bên dưới.
F11 đã triển khai theo phạm vi được chốt, nghiệm thu local ngày 04/10/2026;
Start Attempt HTTP và deadline persisted tiếp tục ở F13. F12 đã triển khai discovery và
lịch sử metadata theo phạm vi được chốt, nghiệm thu local ngày 04/10/2026.
F13–F14 đã triển khai và kiểm chứng local ngày 05/10/2026 theo phạm vi được chốt.
F14 xác nhận hoàn tất; F15 đã bổ sung result policy/UI, history và best score ngày 06/10/2026.
F16–F21 chưa hoàn thành.

Cách triển khai đã thống nhất: dựng nền tảng chung, sau đó hoàn chỉnh từng feature theo chuỗi:

```text
Use case và UI flow → thiết kế bằng UI/UX Pro Max
→ Data model và OpenAPI
→ Migration và backend
→ Frontend tích hợp thật
→ Test và nghiệm thu
→ Đồng bộ tài liệu
```

Mỗi feature có một checklist riêng, gồm phạm vi, dependency, backend/dữ liệu, API/UI, test và điều kiện hoàn thành. Không để mock fallback trong luồng đã tích hợp.

## 2. Quyết định và thứ tự thực hiện

### Quyết định đã chốt

- Chỉ hủy Session `DRAFT` hoặc `SCHEDULED` chưa có Attempt. Đã đồng bộ Use Cases và Screen Flow trong F01.
- Deadline được lưu khi bắt đầu Attempt: `min(startedAt + duration, session.endTime)`.
- Gia hạn Session không đổi deadline của Attempt đã bắt đầu; không mở lại Attempt đã hoàn tất.
- Hoàn chỉnh từng feature; workflow hiện áp dụng thiết kế UI theo từng feature.
- Giữ nguyên stack hiện có, modular monolith và frontend theo feature.
- UI/UX Pro Max là workflow thiết kế, xây dựng và review UI; kết quả skill phải được kiểm tra theo requirement và nền tảng web trước khi áp dụng.
- V1 không bao gồm email notification, chỉ số phân tích nâng cao và advanced browser monitoring.
- Không đưa LMS, AI, payment, essay, partial grading hoặc microservices vào kế hoạch V1.

### Các mốc bàn giao

| Mốc | Feature | Kết quả |
|---|---|---|
| M0 — Nền tảng | F01–F02 | Môi trường chạy được, convention và app shell |
| M1 — Tài khoản | F03–F05 | Local/Google login, multi-role, profile |
| M2 — Soạn và tổ chức thi | F06–F11 | Classroom, Question Bank, import, versioning, Session |
| M3 — Luồng thi hoàn chỉnh | F12–F15 | Discovery, Attempt, autosave, grading, result policy |
| M4 — Hoàn thiện V1 | F16–F20 | Monitoring, analytics, export, notification, admin, dashboard |
| M5 — Nghiệm thu | F21 | E2E, kiểm chứng reliability, tài liệu vận hành |

Thứ tự dưới đây là thứ tự mặc định. Dependency ghi rõ để có thể điều chỉnh lịch mà không triển khai feature trên nền tảng chưa tồn tại.

## 3. Checklist từng feature

### F01 — Chuẩn hóa nền tảng và tài liệu

**Phụ thuộc:** Không.

- [x] Đồng bộ quyết định về hủy Session và deadline vào requirements; giữ workflow hoàn chỉnh từng feature bằng UI/UX Pro Max đã được cập nhật.
- [x] Bổ sung Redis vào môi trường local, cấu hình qua biến môi trường và cập nhật file ví dụ.
- [x] Triển khai health endpoint đúng OpenAPI; phân biệt health công khai với thông tin Actuator cần bảo vệ.
- [x] Thống nhất lỗi API bằng `ProblemDetail`, bổ sung `code` và `fieldErrors`; thống nhất pagination.
- [x] Giữ Flyway làm nguồn schema, `ddl-auto=validate`; bổ sung migration theo từng feature.
- [x] Pin PostgreSQL Testcontainers về major 17 thay cho `postgres:latest`.
- [x] Kiểm tra baseline build/test và cập nhật README hướng dẫn khởi động.
- [x] Chuẩn bị cơ chế audit bền vững trong PostgreSQL để các feature tiếp theo ghi audit cùng transaction nghiệp vụ.

**Nghiệm thu:** Backend/frontend khởi động được theo README; health khớp contract; lỗi không lộ stack trace hoặc secret; test dùng cùng major PostgreSQL với local.

**Kết quả kiểm chứng ngày 26/09/2026:**

- Backend `mvnw.cmd -B verify`: 33 test pass, không fail/error/skip
  (1 context-load, 25 HTTP contract, 7 integration). Testcontainers dùng PostgreSQL
  `17-alpine` và Redis `7.4-alpine`; kiểm tra migration/validate schema, Redis PING,
  audit commit/rollback cùng nghiệp vụ và từ chối ghi ngoài transaction.
- Frontend `npm ci`, `npm run lint`, `npm run build`: thành công.
- `docker compose config --quiet` và `docker compose up -d --wait`: thành công;
  PostgreSQL/Redis healthy. Backend khởi động theo README và áp dụng migration V1.
- HTTP thực tế: `GET /api/v1/health` trả `200 {"status":"UP"}`;
  `/actuator/health` trả 401 `application/problem+json`; frontend production server
  tại localhost:3000 trả HTML 200. Health chỉ là liveness, không xác nhận readiness.
- OpenAPI YAML parse thành công, các `$ref` nội bộ resolve được.
- Môi trường local: Java 21.0.11, Node 24.19.0, Windows/Docker Desktop Linux engine.
  CI cấu hình Java 21/Node 22; chưa chạy Node 22 hoặc CI remote trong phiên này.
  Frontend vẫn là trang khởi tạo, chưa nghiệm thu giao diện F02.

Kiến trúc và cách dùng các thành phần chung:
[Nền tảng F01](../architecture/f01-platform-foundation.md).

### F02 — Frontend foundation và workspace shell

**Phụ thuộc:** F01.

- [x] Dùng UI/UX Pro Max tra cứu và kiểm tra hướng thiết kế phù hợp Learnova trước khi chốt.
- [x] Tạo `design-system/learnova/MASTER.md`; chỉ tạo override trong `pages/` cho màn hình có khác biệt thực sự. Chốt typography hỗ trợ tiếng Việt, semantic tokens, spacing, component states và motion.
- [x] Triển khai CSS variables/Tailwind tokens theo Master; dùng hướng dẫn dành cho web, Next.js và Tailwind, không áp dụng máy móc quy tắc native mobile.
- [x] Tổ chức `app` để routing/composition, `features` cho UI nghiệp vụ và API client tập trung.
- [x] Dựng sidebar, topbar, workspace switcher, user menu và các primitive thực sự cần dùng.
- [x] Giữ root layout là Server Component; đặt auth và interaction trong Client Component phù hợp.
- [x] Chuẩn bị loading, empty, validation, forbidden, not-found và network-error state.
- [x] Bám route map trong Screen Flow; giao diện mặc định tiếng Việt, enum/code giữ tiếng Anh.
- [x] Tạo API client hỗ trợ bearer token, credentials, lỗi có cấu trúc và hủy request không còn cần thiết.

**Nghiệm thu:** Navigation và layout dùng chung nhất quán với Master; kiểm tra keyboard/focus, responsive, contrast và reduced motion; mobile không mất action chính; chưa hiển thị dữ liệu mock như dữ liệu thật.

**Kết quả kiểm chứng ngày 26/09/2026:**

- Theme sáng xanh dương, Plus Jakarta Sans tiếng Việt, token CSS/Tailwind và Master;
  chưa cần override. Đã review ảnh desktop/mobile và contrast của cặp màu chính.
- Shell có sidebar/drawer, switcher theo role collection, user disclosure và trạng thái UI.
  Fixture chỉ trong preview development; production trả HTTP 404. Route thật báo chưa sẵn sàng.
- 28 unit test; 8 browser test trên Edge; 1 production route test và 1 health integration test pass.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`,
  `npm run test:production`, `npm run test:health` thành công trong lần kiểm chứng cuối tương ứng.
- Browser checks gồm 375/768/1024/1440px, keyboard/focus, drawer Escape/return focus,
  role isolation, validation, reduced motion và viewport reflow 640x450 tương đương diện tích CSS
  khi zoom 200% trên 1280x900. Chưa kiểm chứng mọi browser zoom hoặc screen reader.
- Health test gọi backend Spring Boot thật từ Node; chưa kiểm chứng browser CORS/cookie/auth,
  các phần này thuộc F03. Không thay backend hoặc OpenAPI.
- CI đã bổ sung test/typecheck/browser/production checks; chưa chạy remote.
  Local Node 24/Windows/Edge; CI Node 22/Chromium.

Chi tiết và sơ đồ: [Kiến trúc F02](../architecture/f02-frontend-foundation.md).

### F03 — Local authentication và multi-role

**Nguồn:** UC-AUTH-01, 02, 04, 05, 06.  
**Phụ thuộc:** F01–F02.

- [x] Tạo User, role collection và Local AuthIdentity; email chuẩn hóa có unique constraint; password được hash.
- [x] Đăng ký chỉ nhận `PARTICIPANT`, `CREATOR` hoặc cả hai; đăng ký thành công chuyển Login.
- [x] Triển khai login, refresh, logout, logout-all và thông tin người dùng hiện tại.
- [x] JWT 15 phút trả qua JSON và lưu memory; refresh token opaque 7 ngày qua HttpOnly Cookie, chỉ lưu hash trong Redis.
- [x] Rotation atomic, lưu dấu token đã dùng để phát hiện reuse và revoke family.
- [x] Frontend bootstrap sau reload, shared refresh promise, retry request tối đa một lần sau refresh.
- [x] Cấu hình CORS, CSRF cho endpoint dùng cookie và cookie production theo architecture.
- [x] Switch workspace không logout; chỉ hiện workspace có role tương ứng.

**API/UI:** Nhóm `/api/v1/auth`; `/login`, `/register`, workspace resolution.

**Nghiệm thu:** Reject tự cấp ADMIN; duplicate email không tạo hai User; refresh đồng thời và reuse có kết quả nhất quán; logout-all vô hiệu refresh trên mọi thiết bị; không lưu token trong browser storage.

**Kết quả kiểm chứng ngày 28/09/2026:**

- Backend `mvnw.cmd -B verify`: 43 test pass, không fail/error/skip, PostgreSQL 17/Redis 7.4 thật.
- Frontend lint, TypeScript và production build thành công; 44 unit test pass.
- 9 browser auth test, 8 workspace regression test, 1 production route test và 1 health integration test pass.
- OpenAPI parse thành công, 8 paths và 43 internal references hợp lệ.
- Đã kiểm tra cookie/CORS qua Edge, reload hai tab, logout-all hai browser context, offline/retry,
  role isolation, focus, responsive và reduced motion. Không có mock fallback trong auth flow.
- Local Windows/Edge, Java 21/Node 24; CI Java 21/Node 22/Chromium/Linux pass cho commit `b85c0d8`
  tại [GitHub Actions](https://github.com/TranTrongHung123/learnova/actions/runs/36371174077).
  Chưa kiểm thử deployment HTTPS/cookie Secure thực tế. Google Login/profile/ADMIN bootstrap thuộc feature sau.

Chi tiết và sơ đồ: [Kiến trúc F03](../architecture/f03-local-authentication.md).

### F04 — Google Login, onboarding và link account

**Nguồn:** UC-AUTH-03.  
**Phụ thuộc:** F03.

- [x] Triển khai Google authentication qua backend, kiểm tra identity và verified email.
- [x] User mới chọn role qua onboarding trước khi truy cập nghiệp vụ.
- [x] Email trùng Local account yêu cầu xác thực account hiện tại và xác nhận link.
- [x] Identity đã link luôn trở về cùng User; unique constraint ngăn liên kết trùng.
- [x] Sau callback dùng Learnova refresh cookie để lấy access token; không đưa token vào URL.

**API/UI:** Google auth/callback, onboarding và link-account; các route đã có trong Screen Flow.

**Nghiệm thu:** Kiểm tra identity mới, đã link, email trùng, callback lỗi và link đồng thời; không tự link âm thầm.

**Kết quả kiểm chứng ngày 28/09/2026:**

- Backend `mvnw.cmd -B verify`: 56 test pass, không fail/error/skip, gồm 13 Google integration tests.
  PostgreSQL 17/Redis 7.4 thật; kiểm tra ID token signature/issuer/audience/expiry/nonce,
  email verified, state/browser binding, replay, role escalation, link hai bước và concurrency.
- Migration V3 được kiểm chứng trên database mới và schema V2 có User/role cũ.
  Kiểm tra Redis outage, flow hết hạn/thay thế, giới hạn xác minh và phục hồi khi DB đã
  commit nhưng chưa cấp được session. Local authentication regression vẫn pass.
- Frontend `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`: thành công;
  47 unit test pass. `npm run test:google`: 5 test pass với backend thật và OIDC provider
  chỉ trong test classpath; không có mock fallback trong ứng dụng.
- `npm run test:auth`: 9 test pass; `npm run test:e2e`: 8 test pass;
  `npm run test:production`: 1 test pass. Không chạy lại health smoke riêng của F03.
- Browser kiểm tra onboarding/link, reload, hủy, sai mật khẩu, provider denial, mất mạng,
  hai tab, keyboard/focus, reduced motion và viewport 375/768/1024/1440/640x450.
  Đã xem ảnh xác nhận link và onboarding mobile; viewport thấp cuộn dọc để tới action.
- OpenAPI parse thành công: 16 paths và 72 internal references hợp lệ; `git diff --check` sạch.
- Local Windows/Edge, Java 21/Node 24. CI đã thêm Google browser suite nhưng chưa chạy remote.
  Chưa kiểm chứng Google OAuth client thật, consent screen hoặc deployment HTTPS/cookie Secure.
  Hướng dẫn cấu hình nằm trong README và `.env.example`; Google mặc định tắt khi chưa cấu hình.
- Nhánh `feat/f04-google-authentication` tạo từ `origin/main` đã có F03. Bàn giao bằng
  Conventional Commit local; agent không tự push, mở PR hoặc merge.

Chi tiết và sơ đồ: [Kiến trúc F04](../architecture/f04-google-authentication.md).

### F05 — Profile và bảo mật tài khoản

**Nguồn:** UC-USER-01..03.  
**Phụ thuộc:** F03–F04.

- [x] Xem profile; chỉ sửa `displayName`, `avatarUrl`.
- [x] Đổi mật khẩu cho User có Local Identity, bắt buộc xác minh mật khẩu hiện tại.
- [x] Sau đổi mật khẩu giữ phiên hiện tại, revoke các refresh session khác.
- [x] Google-only account không hiện chức năng đổi mật khẩu chưa được hỗ trợ.
- [x] Tích hợp logout-all vào phần Security.

**API/UI:** Nhóm profile hiện tại; `/profile`.

**Nghiệm thu:** Không sửa được email, role hoặc status qua profile payload; password cũ sai bị từ chối; session khác không refresh tiếp được.

**Kết quả kiểm chứng ngày 29/09/2026:**

- Backend `mvnw.cmd -B verify`: 71 test pass, không fail/error/skip, gồm 15 profile integration
  tests với PostgreSQL 17/Redis thật. Kiểm tra JWT/CSRF thật, mass assignment, Unicode,
  Local/Google-only/linked identity, race login/change/refresh/logout, Redis outage, rollback,
  audit và migration V3→V4. CSRF được áp dụng cả bearer auth mutation theo contract.
- Frontend `npm test`: 52 test pass; lint và typecheck pass. Profile dùng API thật, auth
  summary cập nhật sau save; không tự replay password command khi chưa xác định kết quả.
- `npm run build`, `npm run test:e2e` (8 test), `npm run test:production` (1 test): pass.
- `npm run test:auth`: 11 test pass; `npm run test:google`: 5 test pass với OIDC test provider.
  Kiểm chứng sửa profile/reload, password sai, giữ current session, thu hồi thiết bị khác,
  logout-all, Google-only không có form password và lỗi mạng có thể thử lại.
- Chạy lại 2 profile E2E sau bổ sung kiểm tra lưu/xóa avatar và fallback khi tải ảnh lỗi: pass.
- Responsive kiểm tra 375/768/1024/1440px và landscape 640px, reduced motion, error focus,
  dialog Escape/trả focus; không có horizontal overflow. Avatar lỗi dùng chữ cái tên.
- OpenAPI YAML parse thành công, 91 internal refs resolve được, operation IDs không trùng.
- Chưa kiểm chứng CI remote, OAuth Google production hoặc HTTPS triển khai. JWT đã cấp có
  thể còn hiệu lực tối đa 15 phút; Redis revoke không rollback cùng PostgreSQL.

Chi tiết và sơ đồ: [Kiến trúc F05](../architecture/f05-profile-security.md).

### F06 — Classroom và membership

**Nguồn:** UC-CLASS-01..11.  
**Phụ thuộc:** F03, F05.

- [x] Tạo, sửa, liệt kê và xem lớp theo Creator owner.
- [x] Tìm Participant bằng email; thêm membership bằng `userId`.
- [x] Tạo, regenerate, revoke Join Code; mặc định hết hạn sau 7 ngày.
- [x] Participant xem thông tin lớp qua code rồi xác nhận join; revalidate code khi join.
- [x] Join lặp không tạo membership trùng; membership `REMOVED` có thể được kích hoạt lại bằng code hợp lệ.
- [x] Remove/leave chuyển trạng thái membership, giữ lịch sử.

**API/UI:** Nhóm classrooms, members, join-code; màn hình lớp của Creator và Participant.

**Nghiệm thu:** Ownership đúng; code cũ mất hiệu lực sau regenerate; concurrent join không trùng; bổ sung test liên module ở F13 để chứng minh remove không chặn hoàn tất Attempt hiện tại.

**Kiểm chứng F06 ngày 30/09/2026:**

- Backend `mvnw.cmd -B verify`: 86 test pass, không fail/error/skip, trong đó 15 Classroom
  integration tests với PostgreSQL 17/Redis 7.4. Kiểm tra ownership/role hiện tại, tài khoản
  locked/onboarding, cookie không thay bearer, validation, migration V4→V5, DB constraints,
  join/add đồng thời, join chờ khóa gặp regenerate/revoke, expiry boundary và audit rollback.
- Frontend: 52 unit test pass; lint, typecheck và production build thành công. `test:classroom`: 5 test pass
  với API thật, gồm CRUD, lookup email, remove/reactivate, preview/join, hai tab reload,
  revoke sau preview, lỗi mạng/retry, workspace/ownership và confirmation focus.
- Regression: `test:auth` 11, `test:google` 5, `test:e2e` 8, `test:production` 1 test pass.
  `git diff --check` sạch; không chạy lại health smoke riêng của F03.
- UI đã tra cứu UI/UX Pro Max theo web/Next.js/Tailwind và giữ Master hiện có, không cần
  override. Kiểm tra 375/768/1024/1440px và 640×450, reduced motion, keyboard/Escape/return
  focus, nội dung dài; đã xem ảnh desktop/mobile. Chưa kiểm chứng screen reader hoặc
  mọi mức browser zoom; viewport thấp chỉ kiểm tra reflow tương đương.
- OpenAPI YAML parse được: 28 paths, 213 internal references hợp lệ, 33 operationId duy nhất.
- Session trong lớp được tích hợp ở F11–F12; invariant Attempt đang làm tiếp tục sau
  remove/leave kiểm chứng ở F13; in-app CLASS_JOINED tích hợp F18. Không có mock fallback.
- Local Windows/Edge, Java 21/Node 24. Chưa chạy CI remote hoặc deployment HTTPS.
  Bàn giao commit local trên `feat/f06-classroom-membership`; người dùng tự push/mở PR/merge.

Chi tiết và sơ đồ: [Kiến trúc F06](../architecture/f06-classroom-membership.md).

**Sửa regression CI reload hai tab ngày 01/10/2026:**

- Tái hiện bản test cũ local: 1/5 lần fail tại heading sau reload; error context là Login.
  Test chưa chờ bootstrap của tab mới trước khi reload. Chưa có HTTP diagnostics của
  lần fail để khẳng định chi tiết refresh bị ngắt/rotation.
- Bổ sung chờ URL và heading lớp trên cả hai tab trước reload đồng thời, rồi kiểm tra
  cả hai tab sau reload. Không tăng timeout/retry hoặc thay auth behavior.
- Fixture ghi path/status/code lỗi refresh khi test fail vào console và attachment;
  không ghi token/cookie/header/body thành công. Bản sửa pass 20/20 lượt lặp local
  Windows/Edge; lint và typecheck pass. CI Linux/Chromium cần kiểm chứng sau khi push.
- Regression sau bản sửa: toàn bộ 5 Classroom test và 1 auth test reload hai tab pass;
  `git diff --check` sạch. Không chạy lại backend/build vì chỉ sửa test và tài liệu.
- Reload khi refresh còn đang chạy vẫn là tình huống reliability riêng; kết quả này
  chỉ chứng minh kịch bản hai tab đã bootstrap xong trong các lượt kiểm tra đã chạy.

**Hoàn tất bản sửa bootstrap trước tạo lớp ngày 01/10/2026:**

- Helper login chờ URL và heading đích, gồm forbidden/not-found; helper tạo lớp chờ
  heading chi tiết trước khi trả về. Không đổi API, business rule hoặc refresh rotation.
- Thêm regression giữ request refresh của trang đích để kiểm tra helper chưa tạo lớp
  trước khi bootstrap xong; luôn giải phóng request và chuyển tiếp tới backend thật.
- Diagnostics khi fail ghi thứ tự request/navigation, tab, giai đoạn, pathname,
  status và code lỗi CSRF/login/refresh; không ghi query, credential, token hoặc cookie.
- Kiểm chứng local Windows/Edge: lint, typecheck và 52 unit test pass; toàn bộ 6 Classroom
  test pass với backend/PostgreSQL/Redis thật. Hai scenario bootstrap và reload hai tab
  lặp 5 lần mỗi scenario đạt 10/10, `--retries=0`.
- Toàn bộ 11 auth/profile browser test pass. Không chạy lại backend verify hoặc build
  trong đợt này vì thay đổi chỉ nằm ở test và tài liệu.
- CI Linux/Chromium chưa kiểm chứng remote. Không suy rộng kết quả này thành bảo đảm
  điều hướng/reload giữa lúc server đang rotate refresh token.

### F07 — Question Bank

**Nguồn:** UC-QB-01..07.  
**Phụ thuộc:** F03.

- [x] Hỗ trợ bốn loại câu hỏi, options, đáp án, explanation, difficulty, category và tags/topic.
- [x] Tạo/sửa Draft, kích hoạt sau validation; archive và restore theo lifecycle.
- [x] Question private theo Creator; search/filter/pagination xử lý phía backend.
- [x] Numeric answer dùng số chính xác, tolerance mặc định 0 và không âm.
- [x] Nội dung V1 dùng plain text; chưa thêm rich-text editor hoặc upload media.
- [x] Câu archived chỉ xem hoặc restore; không sửa trực tiếp.

**API/UI:** Nhóm questions; danh sách, tạo, chi tiết và chỉnh sửa.

**Nghiệm thu:** Validation đúng từng loại; Creator khác không xem/sửa/reuse; restore chỉ thành ACTIVE khi nội dung hợp lệ.

**Hoàn tất và kiểm chứng local ngày 01/10/2026:**

- API `/api/v1/questions` và UI list/new/detail/edit dùng dữ liệu thật; Flyway V6,
  OpenAPI, requirements và [sơ đồ F07](../architecture/f07-question-bank.md) đã đồng bộ.
- Giữ nháp linh hoạt; restore về ACTIVE nếu hợp lệ, DRAFT nếu chưa đủ. Update/archive/restore
  khóa theo owner và kiểm tra revision; stale request trả 409, audit cùng transaction.
- Numeric lưu `numeric(30,10)` / `BigDecimal`, truyền chuỗi; form để trống tolerance
  gửi `null` để backend áp dụng 0. Browser test kiểm tra cả precision và mặc định này.
- Backend `./mvnw.cmd -B verify`: **93 tests pass**, không skip, gồm 7 Question integration tests
  cho validation, ownership/current role, lifecycle, filter, race, rollback và migration V5 → V6.
- Frontend lint, typecheck, **52 unit tests** và production build pass.
- Playwright `--retries=0`: Question **4/4**, workspace **8/8**, auth/profile **11/11**,
  Google **5/5**, Classroom **6/6**, production routes **1/1**. API integration dùng
  PostgreSQL/Redis thật; Google dùng OIDC provider test, không dùng credential thật.
- Review UI bằng UI/UX Pro Max theo Master; xem ảnh form/list ở 375 và 1440px,
  kiểm tra không tràn ngang ở 375/768/1024/1440 và 640×450, focus/Escape, reduced motion,
  validation, lỗi mạng và conflict hai tab. Không có mock fallback trong feature.
- OpenAPI YAML parse thành công, 273 local references resolve; `git diff --check` pass.
- Môi trường local Windows/Edge, Java 21, Node 24. CI cấu hình Node 22/Linux/Chromium
  đã thêm suite Question nhưng chưa chạy remote. Snapshot/versioning thuộc F09;
  F07 không triển khai hoặc tuyên bố đã kiểm chứng luồng đề/Attempt chưa tồn tại.

### F08 — Excel import có preview

**Nguồn:** UC-QB-08..10.  
**Phụ thuộc:** F07.

- [x] Cung cấp template `.xlsx` tương ứng bốn loại câu hỏi.
- [x] Upload, kiểm tra file thật và giới hạn tài nguyên; parse/validate từng dòng.
- [x] Lưu preview phía server gắn owner và import ID; trả lỗi theo row.
- [x] Mặc định chỉ confirm khi tất cả dòng hợp lệ. Khi có lỗi, cho phép Creator chọn rõ “chỉ import dòng hợp lệ”.
- [x] Confirm sử dụng dữ liệu server đã validate; transaction và trạng thái import ngăn duplicate confirm.
- [x] Dọn dữ liệu preview hết hạn; trả summary số dòng đã import/bỏ qua.

**API/UI:** Upload, preview, confirm; màn hình import dùng cùng route với `importId`.

**Nghiệm thu:** Upload không tạo Question; giả mạo preview, truy cập import người khác và confirm trùng đều được xử lý; file sai định dạng báo lỗi rõ.

**Hoàn tất và kiểm chứng local ngày 02/10/2026:**

- Template chung `Questions` + hướng dẫn bốn loại trong `Instructions`; 5 MiB/file, 1.000 câu hỏi,
  preview 24 giờ. Theo lựa chọn đã chốt: validate đủ nội dung/đáp án nhưng tạo **DRAFT** để rà soát.
- API `/api/v1/question-imports`, Flyway V7 và UI cùng route có `importId`; reload lấy preview server.
  Confirm theo owner có khóa row, transaction chung Question/audit và retry không nhân đôi dữ liệu.
- Parser có giới hạn ZIP entry/giải nén/dòng/ô; từ chối macro/external links, không đánh giá formula.
  Cleanup dọn payload hết hạn theo lô và SKIP LOCKED; giữ metadata, summary đã confirm, audit và Question.
- Backend `mvnw.cmd -B verify`: **106 test pass**, không fail/error/skip, gồm 13 test F08.
  PostgreSQL 17/Redis thật; kiểm tra bốn loại, precision, invalid rows/opt-in, confirm `{}` mặc định,
  tampering, quyền, concurrent confirm, rollback/audit, expiry/cleanup, file/ZIP limits và migration từ V6.
- Frontend `npm run lint`, `npm run typecheck`, `npm test` (**55 test**) và `npm run build` pass.
- Browser `npm run test:import`: **4/4 pass**; regression `test:question` **4/4**, `test:auth`
  **11/11**, `test:production` **1/1**. Kiểm tra download, preview/reload, DRAFT list, opt-in,
  file lỗi, offline/retry và mất response confirm sau khi server đã commit. Không có mock fallback.
- Dùng UI/UX Pro Max theo Master; đã review ảnh desktop/mobile, reflow 375/768/1024/1440px và
  640×450, keyboard focus, checkbox qua bàn phím và reduced motion. Sửa heading thành công để
  giữ đúng semantics, liên kết lỗi với input; selector lỗi không trùng Next route announcer.
- OpenAPI YAML parse thành công: **36 paths, 306 internal references** resolve;
  liên kết tài liệu local và `git diff --check` pass. README/requirements/screen flow đã đồng bộ.
- Local Windows/Edge, Java 21, Node 24; CI Node 22/Linux/Chromium đã thêm suite import nhưng chưa
  chạy remote. Chưa kiểm chứng tải đồng thời lớn, screen reader thực tế hoặc deployment HTTPS.
  Không chạy lại browser Google/Classroom/workspace trong F08; kết quả trước đó nằm ở F07.
- Bàn giao trên `feat/f08-excel-import-preview` bằng Conventional Commit local; không push/mở PR/merge.

Kiến trúc và sơ đồ: [F08 Excel Import](../architecture/f08-excel-import.md).

### F09 — Exam Builder và versioning

**Nguồn:** UC-EXAM-01..07, 09..11.  
**Phụ thuộc:** F07.

- [x] Tạo Exam cùng version 1 DRAFT.
- [x] Thêm câu ACTIVE thuộc owner, bỏ câu, đổi thứ tự và cấu hình points.
- [x] Lưu bản sao nội dung trong Draft để preview và publish cùng một nội dung; Question Bank thay đổi không âm thầm đổi Draft.
- [x] Publish validate toàn bộ Draft, cố định snapshot và ghi audit trong transaction.
- [x] PUBLISHED immutable; tạo Draft mới từ bản đã publish hoặc từ nội dung trống.
- [x] Bảo vệ version number khi tạo đồng thời; archive Exam giữ version/session/history.
- [x] `totalScore` được tính từ points, không có nguồn tổng điểm độc lập.

**API/UI:** Exams, versions, draft questions và publish; Builder, version history và chế độ xem bản published.

**Nghiệm thu:** Publish đồng thời không tạo side effect trùng; sửa/xóa bank không đổi published snapshot; mọi đường sửa published content bị từ chối.

**Bàn giao F09 — 03/10/2026:**

- Migration V8, module `exam`, 9 API operations và UI Creator dùng API thật: list/create,
  Builder, version history, Published view, copy/empty Draft và archive.
- Đã chốt: nhiều Draft đồng thời; archive chỉ chặn Session mới; points >0, mặc định 1.
  Snapshot độc lập ngay từ lúc thêm; copy không đọc bank. Chia đều điểm bằng phép tính chính xác.
- Backend `./mvnw -B clean verify`: **114 tests pass**, gồm 8 integration tests F09,
  migration V7→V8, race publish/save/create version, authorization và audit rollback.
- Frontend `npm test`: **66 tests pass**, gồm 11 tests precision/chia điểm.
  `npm run lint`, `npm run typecheck` và `npm run build` pass.
- Browser API thật `npm run test:exam`: **4 pass**; regression `npm run test:question`:
  **4 pass**; `npm run test:e2e`: **8 pass**; `npm run test:production`: **1 pass**.
- Đã kiểm tra snapshot không đổi khi bank sửa/archive; mất response publish được GET đối soát;
  lỗi mạng/409 giữ input. Keyboard reorder, Escape/focus dialog, 375/768/1024/1440px,
  reduced motion và layout zoom 200% đã được kiểm tra; ảnh mobile/desktop được review.
- OpenAPI parse/schema/internal references/operation IDs và `git diff --check` hợp lệ.
  Requirements, use cases, screen flow, README, CI và sơ đồ kiến trúc đã đồng bộ.
- Session/history sau F11 chưa tồn tại để kiểm thử; F09 không có hard-delete/cascade phá lịch sử.
  F10/F11 giữ nguyên phạm vi feature kế tiếp. Chưa chạy CI remote hoặc đo tải production.
- Bàn giao trên `feat/f09-exam-builder-versioning` bằng Conventional Commit local;
  người dùng tự push, mở PR và merge.

Kiến trúc và sơ đồ: [F09 Exam Builder và versioning](../architecture/f09-exam-builder-versioning.md).

### F10 — Sinh đề theo ma trận

**Nguồn:** UC-EXAM-08.  
**Phụ thuộc:** F09.

- [x] Nhận các rule category/topic, difficulty, question type và quantity.
- [x] Chỉ chọn câu ACTIVE thuộc owner, không trùng câu đã có trong Draft hoặc giữa các rule.
- [x] Kiểm tra đủ candidate cho toàn ma trận trước khi thay đổi Draft.
- [x] Nếu thiếu, trả rule và số lượng thiếu; không cập nhật đề một phần.
- [x] Cho Creator review và sửa kết quả trước publish.

**API/UI:** Candidate preview và generate trong Exam Builder.

**Nghiệm thu:** Ma trận có điều kiện giao nhau không chọn trùng; lỗi thiếu câu không làm thay đổi Draft.

**Bàn giao F10 — 03/10/2026:**

- Hai API `POST /exam-versions/{id}/generation/preview` và `POST /exam-versions/{id}/generation`,
  cùng dialog ma trận trong Exam Builder tích hợp API thật. Preview không ghi hoặc giữ chỗ câu hỏi.
- Maximum matching phân bổ toàn ma trận, tránh báo thiếu sai khi rule giao nhau; generate xáo trộn
  candidate rồi thêm snapshot theo thứ tự rule. Câu mới mặc định 1 điểm, giữ nguyên câu và điểm cũ.
- Category / Topic dùng category hiện có; filter bỏ trống nghĩa là tất cả. Giới hạn 50 rule,
  tổng 500 câu mỗi lần; quantity là JSON integer dương. Không lưu template hoặc thêm migration/dependency.
- Thiếu câu trả thống kê theo rule và không đổi câu/revision/timestamp. Khóa Exam → Version → nguồn
  theo UUID, xác nhận revision/ACTIVE/owner trước khi ghi; xung đột nguồn rollback toàn bộ.
  UI xử lý mất response bằng đọc lại và đối chiếu, không tự sinh lần hai.
- Backend `./mvnw -B clean verify`: **123 tests pass**, gồm 4 unit tests allocator (đối chiếu
  exhaustive oracle trên 200 đồ thị nhỏ) và 5 integration tests F10. Đã kiểm tra generate đua
  generate/save/publish, nguồn đổi trong lúc chờ khóa, ownership, Published và rollback nguyên tử.
- Frontend `npm test`: **66 tests pass**; `npm run lint`, `npm run typecheck`, `npm run build` pass.
  `npm run test:exam`: **8 pass**, gồm 4 E2E F10; hồi quy `npm run test:question`: **4 pass**.
- E2E kiểm tra preview → generate → review/save/publish, thiếu sau preview, stale revision,
  dirty Draft, mất response, keyboard/focus, 375/768/1024/1440px, landscape, reduced motion và zoom.
  Đã xem ảnh kiểm tra mobile/desktop; artifact nằm trong test-results, không commit.
- OpenAPI parse, 54 operation IDs không trùng, 417 tham chiếu nội bộ và `git diff --check` hợp lệ.
  Business requirements, use cases, screen flow và sơ đồ kiến trúc đã đồng bộ.
- Bàn giao trên `feat/f10-exam-matrix-generation` bằng Conventional Commit local;
  người dùng tự push, mở PR và merge. Không triển khai F11; chưa chạy CI remote hoặc đo tải production.

Kiến trúc và sơ đồ: [F10 Sinh đề theo ma trận](../architecture/f10-exam-matrix-generation.md).

### F11 — Exam Session, assignment và lifecycle

**Nguồn:** UC-SESSION-01..07.  
**Phụ thuộc:** F06, F09.

- [x] Tạo Session từ published version của Exam chưa archived.
- [x] Cấu hình lịch, duration, maxAttempts, passingScore, shuffle và result policy.
- [x] Mỗi Session chỉ có PUBLIC, CLASS hoặc INDIVIDUAL; CLASS chỉ chọn lớp owner quản lý.
- [x] Triển khai Schedule và chuyển trạng thái theo server time; request vẫn kiểm tra thời gian khi scheduler trễ.
- [x] Khóa fairness config khi OPEN hoặc đã có Attempt.
- [x] Hủy chỉ DRAFT/SCHEDULED chưa có Attempt; audit cancellation.
- [x] Gia hạn khi SCHEDULED/OPEN, chỉ tăng endTime; không thay deadline từ contract admission. Kiểm chứng deadline Attempt persisted ở F13.
- [x] Mặc định kết quả `SUMMARY + AFTER_SESSION_END`.

**API/UI:** Exam sessions, schedule, cancel, extend-end-time; wizard và trang chi tiết/chỉnh sửa.

**Nghiệm thu:** Không dùng Draft Version; validate cửa sổ thời gian và passingScore;
khóa Session chung cho mutation và contract admission. Kiểm thử Start Attempt HTTP thực tế
và deadline của Attempt persisted chờ F13 theo phạm vi đã chốt.

**Kết quả kiểm chứng ngày 04/10/2026:**

- Migration V9 và module Session; API list/detail/create/update/schedule/cancel/extend;
  assignment PUBLIC/CLASS/INDIVIDUAL và lookup Participant theo email chính xác.
- Schedule trong cửa sổ thi mở ngay. OPEN chỉ sửa tên, result policy/fairness bị khóa;
  SCHEDULED chỉ tăng endTime qua action riêng. Lifecycle dùng server time cả khi job trễ.
- Wizard sáu bước, detail/edit và các dialog dùng API thật; Related Sessions tích hợp
  Exam/Classroom, Upcoming link lọc theo lớp và SCHEDULED. Không có mock fallback.
- Backend `mvnw.cmd -B verify`: 136 test pass, không fail/error/skip; gồm 13 Session
  integration tests. Kiểm tra migration mới/V8→V9, role/ownership, assignment, lifecycle
  biên thời gian, rollback audit, archive/create race và khóa admission-vs-extension.
- Frontend lint/typecheck và production build pass; 66 unit test pass.
  Browser: 4 Session, 8 Exam, 6 Classroom và 1 production route test pass.
- Đã review ảnh detail desktop/mobile; kiểm tra keyboard/focus, Escape/return focus,
  viewport 375/768/1024/1440/640x450 và reduced motion. Chưa kiểm chứng screen reader
  hoặc mọi mức browser zoom. Màu sắc/typography kế thừa Master.
- OpenAPI: 51 paths, 483 internal references resolve; không có duplicate YAML key;
  operation/response maps hợp lệ. Đồng bộ requirements/use cases/screen flow/README.
- Local Windows/Edge, Java 21, Node 24, PostgreSQL 17/Redis 7.4 Testcontainers;
  CI đã thêm Session browser suite nhưng chưa chạy remote hoặc đo tải production.
- `SessionAdmission.reserve` yêu cầu transaction caller, khóa cùng hàng Session và
  rollback firstAttemptAt nếu caller rollback; F13 chịu trách nhiệm duplicate/lượt làm,
  tạo/resume Attempt và bảo toàn deadline persisted. Không có bảng/API Attempt ở F11.
- Bàn giao trên `feat/f11-exam-session` bằng Conventional Commit local;
  người dùng tự push, mở PR và merge.

Kiến trúc và sơ đồ: [F11 Exam Session](../architecture/f11-exam-session.md).

### F12 — Participant exam discovery

**Nguồn:** UC-PARTEXAM-01..06.  
**Phụ thuộc:** F11.

- [x] My Exams có Upcoming, Available, Completed, Expired.
- [x] Query theo quyền PUBLIC/CLASS/INDIVIDUAL, không fetch toàn bộ rồi lọc ở browser.
- [x] Chi tiết trả thời gian, số câu, tổng điểm, lượt đã dùng và khả năng Start/Continue.
- [x] Không gửi nội dung đề đầy đủ hoặc đáp án trước Start.
- [x] Giữ đường truy cập lịch sử metadata Attempt dù membership sau này bị remove; Result detail tiếp tục ở F15 theo phạm vi đã chốt.

**API/UI:** Participant session list/detail; `/participant/exams`.

**Nghiệm thu:** PUBLIC yêu cầu login và role PARTICIPANT; membership không ACTIVE không cấp quyền start mới; tabs có thể giao nhau khi một Session đã hoàn thành nhưng còn lượt.

**Bàn giao F12 — 04/10/2026:**

- Ba API GET Participant session list/detail/history, DTO riêng không chứa nội dung câu hỏi,
  đáp án, explanation, điểm bài làm hoặc pass/fail. Lọc quyền, tab và phân trang ở database;
  effective status dùng server time kể cả khi scheduler trễ.
- Available chỉ gồm canStart hoặc canContinue; Completed/Available/Expired có thể giao nhau.
  Mất membership không mất metadata/history hoặc khả năng Continue bài còn hạn; IN_PROGRESS
  quá deadline chờ finalize vẫn chiếm lượt và không cho Start mới.
- Migration V10 thêm nền metadata Attempt, FK bảo toàn lịch sử và cặp Session/ExamVersion,
  unique số lượt và partial unique một IN_PROGRESS. Chưa có production API ghi Attempt.
- `/participant/exams` và detail tích hợp API thật, tab/page giữ trong URL, loading/empty/error/retry,
  refetch khi trở lại cửa sổ, loại phản hồi cũ. Start/Continue/kết quả disabled kèm “Sắp có”;
  F13–F15 triển khai command làm bài, grading và kết quả. Không có mock fallback.
- Backend `mvnw.cmd -B verify`: **144 tests pass**, không fail/error/skip, BUILD SUCCESS;
  gồm 8 integration tests F12 về quyền, biên thời gian, tabs, membership, history isolation,
  pagination, constraints và nâng cấp V9→V10.
- Frontend lint/typecheck/build pass, **66 unit tests pass**. Browser: **3 Discovery,
  4 Session, 6 Classroom và 1 production test pass**. Discovery dùng fixture database thật
  chỉ trên test classpath; đã kiểm tra fixture không nằm trong JAR production.
- Đã xem ảnh mobile/desktop và kiểm tra 375/768/1024/1440px, landscape, zoom 200%,
  keyboard và reduced motion. Chưa kiểm chứng screen reader, CI remote hoặc tải production.
- OpenAPI: 54 paths, 65 operation IDs không trùng, 503 tham chiếu hợp lệ; requirements,
  use cases, screen flow, README và sơ đồ kiến trúc đã đồng bộ.
- Bàn giao trên `feat/f12-participant-exam-discovery` bằng Conventional Commit local;
  người dùng tự push, mở PR và merge.

Kiến trúc và sơ đồ: [F12 Participant exam discovery](../architecture/f12-participant-exam-discovery.md).

### F13 — Start, resume, stable shuffle và autosave

**Nguồn:** UC-PARTEXAM-07, UC-ATTEMPT-01..06, UC-SYSTEM-01.  
**Phụ thuộc:** F12.

- [x] Start kiểm tra account, role, assignment, Session và giới hạn lượt bằng transaction.
- [x] Ngăn duplicate active Attempt và vượt maxAttempts bằng khóa phù hợp cùng DB constraint.
- [x] Lưu deadline, version và thứ tự question/option cụ thể khi Start.
- [x] Resume khôi phục answers, review marks, order và deadline.
- [x] Autosave validate owner, trạng thái, deadline, question/option thuộc snapshot.
- [x] Dùng revision phía server để phát hiện cập nhật cũ; frontend tuần tự hóa/coalesce save theo câu.
- [x] UI có navigation, review marks, timer theo server time và trạng thái dirty/saving/saved/failed.
- [x] DTO làm bài không chứa correct answer, explanation hoặc grading metadata.
- [x] Thu thập thời gian tương tác từng câu phục vụ analytics; đây là telemetry ước lượng, không dùng chấm điểm.

**API/UI:** Start/resume/read Attempt, save answer/review state; Exam Taking.

**Nghiệm thu:** Double-start trả cùng active Attempt; reload giữ shuffle; phản hồi save cũ không đánh dấu input mới là Saved; mất mạng hiển thị chưa lưu; remove khỏi lớp vẫn resume được Attempt đã bắt đầu.

**Bàn giao F13 — 05/10/2026:**

- Ba API Start/read/save answer với DTO Participant riêng; khóa Session bảo vệ double-start,
  giới hạn lượt và config/cancel, khóa Attempt bảo vệ save với deadline do server quyết định.
- Migration V11 thêm câu/order/answer/review/revision/telemetry, FK kép bảo toàn ExamVersion.
  Metadata F12 được backfill theo thứ tự snapshot gốc, không tạo answer hoặc telemetry giả.
- UI Start confirmation, layout làm bài tập trung, bốn loại câu, navigator/review, timer,
  queue từng câu, retry hữu hạn và đối chiếu hai tab. Giữ input mới khi response cũ đến;
  mất response và telemetry bị cap không tạo conflict giả. Lỗi 403/404/network phân biệt rõ.
- Hết hạn khóa sửa, giữ IN_PROGRESS chờ F14; Submit, auto-finalize, grading và result chưa
  triển khai trong F13. Không có offline persistence; chỉ dữ liệu đã xác nhận được resume.
- Backend `mvnw.cmd -B verify`: **155 tests pass**, không fail/error/skip, BUILD SUCCESS;
  gồm 11 integration tests F13 trên PostgreSQL 17/Redis 7.4 và migration V10→V11.
- Frontend lint/typecheck/build pass; **82 unit tests pass**, gồm 16 test autosave/retry/error.
  Browser **5 Attempt, 3 Discovery, 4 Session, 6 Classroom và 1 production test pass**.
- Đã review ảnh desktop/mobile, keyboard/focus, 375/768/1024/1440px, landscape,
  zoom 200% và reduced motion. Browser chạy API/backend thật, không mock fallback.
- OpenAPI: 57 paths, 68 operation IDs duy nhất, 531 tham chiếu hợp lệ. JAR production
  chứa API/migration F13 và không chứa fixture controller. UTF-8, liên kết tài liệu và diff đã kiểm tra.
- Local Windows/Edge, Java 21/Node 24. CI có suite Attempt nhưng chưa chạy remote;
  chưa kiểm chứng screen reader, tải production hoặc deployment HTTPS.
- Bàn giao trên `feat/f13-attempt-autosave` bằng Conventional Commit local;
  người dùng tự push, mở PR và merge.

Kiến trúc và sơ đồ: [F13 Attempt/autosave](../architecture/f13-attempt-autosave.md).

### F14 — Submit, auto-finalize và automatic grading

**Nguồn:** UC-ATTEMPT-07, UC-SYSTEM-02, UC-GRADE-01.  
**Phụ thuộc:** F13.

- [x] Manual submit và expiration dùng chung một nghiệp vụ finalize.
- [x] Khóa Attempt khi finalize; ngăn autosave thay đổi dữ liệu đã dùng để chấm.
- [x] Scheduler và lazy deadline check cùng gọi operation idempotent; xử lý lại các bài quá hạn sau restart.
- [x] Chấm đúng snapshot: exact match, exact-set match, absolute tolerance; câu chưa trả lời 0 điểm.
- [x] Dùng `BigDecimal`; pass/fail theo raw score, hiển thị hai chữ số HALF_UP.
- [x] Lưu một Result cho mỗi Attempt, chi tiết điểm từng câu và lý do kết thúc để phân biệt submit/expired sau khi GRADED.
- [x] Frontend đợi save được xác nhận trước submit; nếu timeout, fetch lại trạng thái authoritative.

**API/UI:** Submit command và finalization state; không trả điểm/đáp án vượt result policy trong response submit.

**Nghiệm thu:** Double-submit, submit-vs-expiration và save-vs-submit không chấm hai lần; backend vẫn finalize khi browser đóng; test biên tolerance và rounding.

**Bàn giao F14 — 05/10/2026:**

- POST submit, lazy expiration và scheduler dùng chung finalize với khóa Attempt; Result,
  điểm từng câu và GRADED commit nguyên tử. Migration V12 giữ completionReason và timestamp.
- Chấm snapshot bằng BigDecimal, exact-set/absolute tolerance; raw pass/fail và formatter
  HALF_UP. Unique/FK/check bảo vệ dữ liệu. Save đến muộn không rollback kết quả đã finalize.
- UI có dialog xác nhận, drain autosave, xử lý conflict/lỗi lưu, refetch khi mất response,
  trạng thái hoàn tất/hết giờ và focus heading. Không trả điểm/pass-fail/đáp án ở F14.
- Backend `mvnw.cmd -B verify`: **167 tests pass**, không fail/error/skip, BUILD SUCCESS;
  gồm 18 Attempt integration tests và 5 grading unit tests. Kiểm tra race, rollback/retry,
  scheduler, ownership, migration V10→V12 và response không lộ kết quả.
- Frontend lint/typecheck/build pass; **88 unit tests pass**, gồm 22 test autosave/submit.
  Browser **8 Attempt, 3 Discovery, 4 Session và 1 production tests pass** với API thật.
- Browser kiểm chứng save trước submit, mất response sau commit, hết giờ khi dialog mở,
  scheduler khi browser đóng, reload, keyboard/focus và các viewport 375/768/1024/1440,
  landscape, zoom 200%, reduced motion. Đã xem ảnh dialog desktop/mobile và final state.
- OpenAPI: 58 paths, 69 operation IDs duy nhất, 537 tham chiếu hợp lệ. JAR production
  có migration/service F14 và không có fixture controller. UTF-8, link và diff đã kiểm tra.
- Local Windows/Edge, PostgreSQL 17/Redis 7.4 Testcontainers. Chưa kiểm chứng screen reader,
  tải production, CI remote hoặc deployment HTTPS; không mở rộng F15/result visibility.
- Bàn giao trên `feat/f14-submit-finalize-grading` bằng Conventional Commit local;
  người dùng tự push, mở PR và merge.

Kiến trúc và sơ đồ: [F14 Submit/finalize/grading](../architecture/f14-submit-finalize-grading.md).

### F15 — Result visibility, history và best score

**Nguồn:** UC-RESULT-01..03, UC-SESSION-08.  
**Phụ thuộc:** F14.

- [x] Creator xem kết quả Session, danh sách Participant và toàn bộ Attempt.
- [x] Participant xem history/detail theo cả display mode lẫn release policy.
- [x] Backend tính BEST_SCORE trên các Attempt đã chấm; giữ đầy đủ lịch sử.
- [x] Manual release idempotent và được audit.
- [x] Bảo vệ policy trên các response hiện có: submit, history, Session detail; dashboard F20 và notification F18 chưa có payload kết quả, phải dùng cùng policy khi triển khai.
- [x] HIDDEN vẫn không trả điểm dù điều kiện release đã đạt; DETAILED mới cho xem đáp án/explanation.

**API/UI:** Participant results/history, Creator Session results, release-results.

**Nghiệm thu:** Test toàn bộ 4 display modes × 3 release policies, trước/sau điều kiện release; người khác không truy cập kết quả; gia hạn trước endTime làm thời điểm AFTER_SESSION_END theo endTime mới.

**Kết quả triển khai ngày 06/10/2026:**

- V13 lưu thời điểm công bố thủ công. Khóa Session, timestamp và audit cùng transaction;
  retry/concurrent release chỉ ghi một lần, audit lỗi rollback công bố.
- Backend read projection dùng persisted grading và snapshot; history tính best trước
  pagination. Hòa điểm chọn submittedAt sớm hơn, rồi UUID. Không trả bestAttemptId khi
  chưa được xem điểm. Creator thấy assignment hiện tại hợp với lịch sử Attempt.
- Frontend tích hợp API thật cho history, detail, mọi lượt của Participant và manual release;
  nối sidebar, discovery history, submit completion và Creator Session detail.
- Backend `mvnw.cmd -B verify`: 171 test pass. Sau bổ sung hai test rollback/tie/pagination,
  suite `AttemptIntegrationTests`: 24 test pass, gồm toàn bộ test F13–F15 trong suite này.
- Frontend lint, typecheck, 88 unit test và production build pass. Browser F15: 2 test pass;
  Discovery: 3 test pass; Attempt: 8 test pass. Kiểm tra API thật, policy, ownership, offline/retry, modal focus,
  viewport 375/768/1024/1440 và 640×450 với reduced motion; đã review ảnh result mobile.
- OpenAPI: 65 paths, 600 internal references hợp lệ, không duplicate key. CI đã thêm suite
  result nhưng chưa chạy remote; chưa kiểm chứng mọi browser/screen reader hoặc HTTPS thật.

Kiến trúc và sơ đồ: [F15 Result visibility/history](../architecture/f15-result-visibility-history.md).

### F16 — Realtime monitoring

**Nguồn:** UC-MON-01.  
**Phụ thuộc:** F13–F15.

- [ ] REST snapshot cho Session owner; WebSocket gửi incremental updates sau khi nghiệp vụ commit.
- [ ] Hiển thị progress, answered count, lastSeen và trạng thái kết nối.
- [ ] Tách trạng thái kết nối khỏi trạng thái Attempt; disconnected không đồng nghĩa submitted/expired.
- [ ] Authorize kết nối và subscription; không dùng refresh token hoặc gửi đáp án qua event.
- [ ] Reconnect refetch snapshot, resubscribe và đối soát để tránh thiếu update trong khoảng nối lại.
- [ ] PUBLIC không có danh sách người được giao cố định: số “Not Started” hiển thị không áp dụng.

**Nghiệm thu:** Creator khác không subscribe được; duplicate/out-of-order event không làm lùi trạng thái; mất WebSocket không mất answers/results.

### F17 — Reporting, question analytics và Excel export

**Nguồn:** UC-REPORT-01..03.  
**Phụ thuộc:** F15, telemetry từ F13.

- [ ] Tính average/highest/lowest, pass rate và score distribution theo BEST_SCORE mỗi Participant trong Session.
- [ ] Question analytics mặc định dùng toàn bộ Attempt đã GRADED và ghi rõ mẫu thống kê.
- [ ] Correct/incorrect/unanswered dựa snapshot; average answer time chỉ dùng telemetry hợp lệ, thiếu dữ liệu hiển thị không có dữ liệu.
- [ ] Completion rate cho CLASS/INDIVIDUAL dùng tập Participant hiện được giao hợp nhất với người đã có Attempt; PUBLIC hiển thị không áp dụng.
- [ ] Export `.xlsx` từ backend, đầy đủ các cột đã nêu trong requirements.
- [ ] Export không phụ thuộc trang hiện tại trên UI; xử lý giá trị text để không trở thành công thức Excel.

**API/UI:** Session analytics/export; biểu đồ và bảng question analytics.

**Nghiệm thu:** Aggregate khớp fixture biết trước; nhiều lượt không làm sai BEST_SCORE; mẫu số 0 không chia lỗi; sửa bank không đổi báo cáo cũ; export đúng quyền và đủ dữ liệu.

### F18 — In-app notifications

**Nguồn:** UC-NOTI-01..03.  
**Phụ thuộc:** F06, F11, F15.

- [ ] Lưu notification, list/pagination, unread count, mark-read và mark-all-read theo owner.
- [ ] Tích hợp `EXAM_ASSIGNED`, `EXAM_REMINDER`, `RESULT_RELEASED`, `CLASS_JOINED`.
- [ ] Assignment notification phát khi Session được Schedule hoặc Participant mới đủ điều kiện nhận Session đã Schedule.
- [ ] PUBLIC không gửi assignment/reminder hàng loạt tới toàn bộ User.
- [ ] Reminder mặc định 24 giờ trước start; Session được schedule muộn hơn không gửi nhắc bù trùng với assignment.
- [ ] Result notification chỉ phát khi người nhận thực sự được phép xem kết quả.
- [ ] Dùng persistence và khóa chống trùng theo event/recipient; job retry không tạo notification lặp.
- [ ] Deep link là route nội bộ; truy cập resource vẫn được backend kiểm tra.

**Nghiệm thu:** Không đọc/sửa thông báo người khác; rollback nghiệp vụ không để notification sai; job chạy lại không nhân đôi.

### F19 — Admin User Management và Audit UI

**Nguồn:** UC-ADMIN-01..06, 08.  
**Phụ thuộc:** F03 và audit từ F01.

- [ ] Bootstrap ADMIN bằng cơ chế vận hành có cấu hình bảo vệ, không có mật khẩu mặc định được commit.
- [ ] List/search/filter/detail User; lock, unlock và quản lý PARTICIPANT/CREATOR.
- [ ] Lock chặn login/refresh, revoke refresh sessions; unlock yêu cầu login lại.
- [ ] Giữ trade-off access JWT tối đa 15 phút theo Use Cases; Start Attempt vẫn kiểm tra account ACTIVE.
- [ ] UI quản trị không cấp ADMIN và không mặc định có quyền nghiệp vụ Creator/Participant.
- [ ] Audit list/filter theo actor, action, target và thời gian; không expose secret.

**Nghiệm thu:** Participant/Creator bị chặn khỏi Admin API; request sửa role trái phép bị reject; lock/unlock không xóa lịch sử; mỗi critical mutation có audit tương ứng.

### F20 — Dashboard ba workspace

**Nguồn:** Phần Dashboard trong requirements; UC-ADMIN-07.  
**Phụ thuộc:** F15–F19.

- [ ] Participant: kỳ thi sắp tới/khả dụng, Attempt đang làm, kết quả được phép xem và notification.
- [ ] Creator: Question/Exam counts, active/upcoming Sessions, Participant counts và quick actions.
- [ ] Admin: thống kê User, role, Exam và Session; label “tài khoản ACTIVE” phản ánh account status.
- [ ] Query aggregate ở backend; không tải toàn bộ danh sách để tính phía client.
- [ ] Điểm trung bình Participant chỉ dùng kết quả đã được policy cho phép xem; hiển thị rõ thang điểm khi tổng hợp khác đề.

**Nghiệm thu:** Không rò rỉ kết quả chưa release qua card/average; User multi-role switch workspace không logout; có loading/empty/error state đúng.

### F21 — Nghiệm thu V1 và vận hành

**Phụ thuộc:** F01–F20.

- [ ] E2E flow chuẩn: tạo lớp → join → import → build/publish → Schedule → làm bài/autosave → submit → release → analytics/export.
- [ ] E2E bổ sung PUBLIC, INDIVIDUAL, Google onboarding/link và multi-role.
- [ ] Kiểm chứng reload, mất mạng, reconnect, expiry khi browser đóng và backend restart.
- [ ] Chạy migration trên database mới và database có lịch sử.
- [ ] Hoàn thiện CI backend, frontend lint/build và bộ test hành vi đã bổ sung.
- [ ] Bổ sung cấu hình triển khai, readiness, backup/restore và log không chứa secret.
- [ ] Ghi nhận tải thử, môi trường đo, kết quả và giới hạn thực tế; không tự tuyên bố production-ready.
- [ ] Hoàn thiện sơ đồ kiến trúc, ERD và flow quan trọng trong `docs/architecture/`.

## 4. API, kiểm thử và điều kiện hoàn thành

### Quy tắc contract

- Mở rộng `docs/api/openapi.yaml` theo từng feature trước hoặc cùng implementation.
- Mỗi operation mô tả authentication, request/response, validation, business error và trạng thái HTTP.
- Tách DTO Creator, Active Attempt và Result theo mức hiển thị.
- Bổ sung các command rõ nghĩa: publish version, schedule/cancel/extend Session, start/submit Attempt, confirm import và release results.
- WebSocket có tài liệu event/auth/subscription riêng; không coi OpenAPI hiện tại là đã mô tả realtime.
- Timestamp có timezone, score/tolerance dùng biểu diễn số chính xác xuyên suốt backend và persistence.

### Test bắt buộc

| Nhóm | Kịch bản chính |
|---|---|
| Auth | Refresh rotation/reuse, concurrent refresh, role escalation, Google link |
| Ownership | Truy cập chéo Creator, Participant và Admin |
| Versioning | Published immutable, snapshot không đổi, concurrent publish/version creation |
| Session | State transition, config lock, cancel/start race, extend giữ deadline |
| Attempt | Double-start, maxAttempts, stable shuffle, resume, stale autosave |
| Finalization | Double-submit, scheduler-vs-submit, save-vs-finalize, restart recovery |
| Grading | Bốn loại câu, unanswered, tolerance boundary, raw score và rounding |
| Results | Ma trận visibility, BEST_SCORE, chống leak qua history/dashboard |
| Import | Preview tampering, invalid rows, duplicate confirm |
| Realtime | Unauthorized subscription, disconnect/reconnect, missed/duplicate events |
| History | Remove membership, archive, lock vẫn giữ Attempt/Result |
| Reporting | Aggregate fixture, dữ liệu rỗng, export đủ và đúng |

### Definition of Done cho mỗi feature

- [ ] Trước khi sửa code, đã kiểm tra working tree và chuyển sang nhánh `feat/<feature-id>-<slug>` từ `origin/main` đã cập nhật; nếu đang ở đúng nhánh feature thì tiếp tục. Không triển khai/commit feature trực tiếp trên `main`, không tự bỏ thay đổi đang có.
- [ ] Có mapping tới use case và screen flow.
- [ ] Feature có UI được thiết kế/review bằng UI/UX Pro Max theo Master và override phù hợp; kiểm tra semantic tokens, keyboard/focus, responsive, contrast và reduced motion.
- [ ] API, migration, backend và frontend nhất quán.
- [ ] Backend tuân thủ [quy ước package](../architecture/backend-package-structure.md): module theo nghiệp vụ, bên trong nhóm theo trách nhiệm, không tạo package rỗng hoặc mở quyền truy cập dư thừa.
- [ ] Authorization, ownership, state và deadline được backend enforce.
- [ ] Các test quan trọng của feature pass; ghi rõ lệnh đã chạy.
- [ ] Không còn mock trong luồng thật.
- [ ] Tài liệu được đồng bộ; feature quan trọng có sơ đồ trong `docs/architecture/`.
- [ ] Không chứa secret hoặc sửa đè thay đổi đang có của người dùng.
- [ ] Có commit Conventional Commits sau khi feature hoàn thành.
- [ ] Đã bàn giao commit local và kết quả kiểm chứng để người dùng tự push nhánh, mở pull request và merge. Agent không tự push, mở PR hoặc merge nếu chưa có yêu cầu rõ ràng mới.

Checkbox đã đánh dấu ở F01 phản ánh công việc đã triển khai và kiểm chứng nêu trên.
Các checkbox còn lại là công việc chưa hoàn thành; Definition of Done là checklist
áp dụng riêng cho từng feature, không phải xác nhận toàn bộ V1 đã hoàn tất.
