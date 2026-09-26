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
| Database | PostgreSQL 17, Flyway migration V1 cho audit; Hibernate validate schema |
| Authentication | Security chỉ mở GET health, chặn Actuator; flow xác thực thuộc F03 |
| Frontend | Next.js 16.3.6, React 19.2.8, Tailwind; có design system, workspace shell và API transport F02 |
| Redis, WebSocket | Redis 7.4 đã cấu hình local/Testcontainers; WebSocket chưa triển khai |
| OpenAPI | Health đã triển khai; có schema lỗi và convention pagination dùng chung |
| Testing | 33 test backend pass, gồm HTTP contract và transaction audit trên PostgreSQL/Redis thật |
| CI | Cấu hình backend verify bằng Testcontainers, frontend lint/build; chưa chạy CI remote trong phiên |
| Tài liệu | Đã đồng bộ hủy Session/deadline, README local và sơ đồ nền tảng F01 |

**F01–F02 đã hoàn thành và kiểm chứng local ngày 26/09/2026.** M0 hoàn thành;
F03–F21 chưa hoàn thành. Kết quả và giới hạn kiểm chứng được ghi tại từng feature bên dưới.

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

- [ ] Tạo User, role collection và Local AuthIdentity; email chuẩn hóa có unique constraint; password được hash.
- [ ] Đăng ký chỉ nhận `PARTICIPANT`, `CREATOR` hoặc cả hai; đăng ký thành công chuyển Login.
- [ ] Triển khai login, refresh, logout, logout-all và thông tin người dùng hiện tại.
- [ ] JWT 15 phút trả qua JSON và lưu memory; refresh token opaque 7 ngày qua HttpOnly Cookie, chỉ lưu hash trong Redis.
- [ ] Rotation atomic, lưu dấu token đã dùng để phát hiện reuse và revoke family.
- [ ] Frontend bootstrap sau reload, shared refresh promise, retry request tối đa một lần sau refresh.
- [ ] Cấu hình CORS, CSRF cho endpoint dùng cookie và cookie production theo architecture.
- [ ] Switch workspace không logout; chỉ hiện workspace có role tương ứng.

**API/UI:** Nhóm `/api/v1/auth`; `/login`, `/register`, workspace resolution.

**Nghiệm thu:** Reject tự cấp ADMIN; duplicate email không tạo hai User; refresh đồng thời và reuse có kết quả nhất quán; logout-all vô hiệu refresh trên mọi thiết bị; không lưu token trong browser storage.

### F04 — Google Login, onboarding và link account

**Nguồn:** UC-AUTH-03.  
**Phụ thuộc:** F03.

- [ ] Triển khai Google authentication qua backend, kiểm tra identity và verified email.
- [ ] User mới chọn role qua onboarding trước khi truy cập nghiệp vụ.
- [ ] Email trùng Local account yêu cầu xác thực account hiện tại và xác nhận link.
- [ ] Identity đã link luôn trở về cùng User; unique constraint ngăn liên kết trùng.
- [ ] Sau callback dùng Learnova refresh cookie để lấy access token; không đưa token vào URL.

**API/UI:** Google auth/callback, onboarding và link-account; các route đã có trong Screen Flow.

**Nghiệm thu:** Kiểm tra identity mới, đã link, email trùng, callback lỗi và link đồng thời; không tự link âm thầm.

### F05 — Profile và bảo mật tài khoản

**Nguồn:** UC-USER-01..03.  
**Phụ thuộc:** F03–F04.

- [ ] Xem profile; chỉ sửa `displayName`, `avatarUrl`.
- [ ] Đổi mật khẩu cho User có Local Identity, bắt buộc xác minh mật khẩu hiện tại.
- [ ] Sau đổi mật khẩu giữ phiên hiện tại, revoke các refresh session khác.
- [ ] Google-only account không hiện chức năng đổi mật khẩu chưa được hỗ trợ.
- [ ] Tích hợp logout-all vào phần Security.

**API/UI:** Nhóm profile hiện tại; `/profile`.

**Nghiệm thu:** Không sửa được email, role hoặc status qua profile payload; password cũ sai bị từ chối; session khác không refresh tiếp được.

### F06 — Classroom và membership

**Nguồn:** UC-CLASS-01..11.  
**Phụ thuộc:** F03, F05.

- [ ] Tạo, sửa, liệt kê và xem lớp theo Creator owner.
- [ ] Tìm Participant bằng email; thêm membership bằng `userId`.
- [ ] Tạo, regenerate, revoke Join Code; mặc định hết hạn sau 7 ngày.
- [ ] Participant xem thông tin lớp qua code rồi xác nhận join; revalidate code khi join.
- [ ] Join lặp không tạo membership trùng; membership `REMOVED` có thể được kích hoạt lại bằng code hợp lệ.
- [ ] Remove/leave chuyển trạng thái membership, giữ lịch sử.

**API/UI:** Nhóm classrooms, members, join-code; màn hình lớp của Creator và Participant.

**Nghiệm thu:** Ownership đúng; code cũ mất hiệu lực sau regenerate; concurrent join không trùng; bổ sung test liên module ở F13 để chứng minh remove không chặn hoàn tất Attempt hiện tại.

### F07 — Question Bank

**Nguồn:** UC-QB-01..07.  
**Phụ thuộc:** F03.

- [ ] Hỗ trợ bốn loại câu hỏi, options, đáp án, explanation, difficulty, category và tags/topic.
- [ ] Tạo/sửa Draft, kích hoạt sau validation; archive và restore theo lifecycle.
- [ ] Question private theo Creator; search/filter/pagination xử lý phía backend.
- [ ] Numeric answer dùng số chính xác, tolerance mặc định 0 và không âm.
- [ ] Nội dung V1 dùng plain text; chưa thêm rich-text editor hoặc upload media.
- [ ] Câu archived chỉ xem hoặc restore; không sửa trực tiếp.

**API/UI:** Nhóm questions; danh sách, tạo, chi tiết và chỉnh sửa.

**Nghiệm thu:** Validation đúng từng loại; Creator khác không xem/sửa/reuse; restore chỉ thành ACTIVE khi nội dung hợp lệ.

### F08 — Excel import có preview

**Nguồn:** UC-QB-08..10.  
**Phụ thuộc:** F07.

- [ ] Cung cấp template `.xlsx` tương ứng bốn loại câu hỏi.
- [ ] Upload, kiểm tra file thật và giới hạn tài nguyên; parse/validate từng dòng.
- [ ] Lưu preview phía server gắn owner và import ID; trả lỗi theo row.
- [ ] Mặc định chỉ confirm khi tất cả dòng hợp lệ. Khi có lỗi, cho phép Creator chọn rõ “chỉ import dòng hợp lệ”.
- [ ] Confirm sử dụng dữ liệu server đã validate; transaction và trạng thái import ngăn duplicate confirm.
- [ ] Dọn dữ liệu preview hết hạn; trả summary số dòng đã import/bỏ qua.

**API/UI:** Upload, preview, confirm; màn hình import dùng cùng route với `importId`.

**Nghiệm thu:** Upload không tạo Question; giả mạo preview, truy cập import người khác và confirm trùng đều được xử lý; file sai định dạng báo lỗi rõ.

### F09 — Exam Builder và versioning

**Nguồn:** UC-EXAM-01..07, 09..11.  
**Phụ thuộc:** F07.

- [ ] Tạo Exam cùng version 1 DRAFT.
- [ ] Thêm câu ACTIVE thuộc owner, bỏ câu, đổi thứ tự và cấu hình points.
- [ ] Lưu bản sao nội dung trong Draft để preview và publish cùng một nội dung; Question Bank thay đổi không âm thầm đổi Draft.
- [ ] Publish validate toàn bộ Draft, cố định snapshot và ghi audit trong transaction.
- [ ] PUBLISHED immutable; tạo Draft mới từ bản đã publish hoặc từ nội dung trống.
- [ ] Bảo vệ version number khi tạo đồng thời; archive Exam giữ version/session/history.
- [ ] `totalScore` được tính từ points, không có nguồn tổng điểm độc lập.

**API/UI:** Exams, versions, draft questions và publish; Builder, version history và chế độ xem bản published.

**Nghiệm thu:** Publish đồng thời không tạo side effect trùng; sửa/xóa bank không đổi published snapshot; mọi đường sửa published content bị từ chối.

### F10 — Sinh đề theo ma trận

**Nguồn:** UC-EXAM-08.  
**Phụ thuộc:** F09.

- [ ] Nhận các rule category/topic, difficulty, question type và quantity.
- [ ] Chỉ chọn câu ACTIVE thuộc owner, không trùng câu đã có trong Draft hoặc giữa các rule.
- [ ] Kiểm tra đủ candidate cho toàn ma trận trước khi thay đổi Draft.
- [ ] Nếu thiếu, trả rule và số lượng thiếu; không cập nhật đề một phần.
- [ ] Cho Creator review và sửa kết quả trước publish.

**API/UI:** Candidate preview và generate trong Exam Builder.

**Nghiệm thu:** Ma trận có điều kiện giao nhau không chọn trùng; lỗi thiếu câu không làm thay đổi Draft.

### F11 — Exam Session, assignment và lifecycle

**Nguồn:** UC-SESSION-01..07.  
**Phụ thuộc:** F06, F09.

- [ ] Tạo Session từ published version của Exam chưa archived.
- [ ] Cấu hình lịch, duration, maxAttempts, passingScore, shuffle và result policy.
- [ ] Mỗi Session chỉ có PUBLIC, CLASS hoặc INDIVIDUAL; CLASS chỉ chọn lớp owner quản lý.
- [ ] Triển khai Schedule và chuyển trạng thái theo server time; request vẫn kiểm tra thời gian khi scheduler trễ.
- [ ] Khóa fairness config khi OPEN hoặc đã có Attempt.
- [ ] Hủy chỉ DRAFT/SCHEDULED chưa có Attempt; audit cancellation.
- [ ] Gia hạn khi SCHEDULED/OPEN, chỉ tăng endTime; giữ deadline các Attempt đã tạo.
- [ ] Mặc định kết quả `SUMMARY + AFTER_SESSION_END`.

**API/UI:** Exam sessions, schedule, cancel, extend-end-time; wizard và trang chi tiết/chỉnh sửa.

**Nghiệm thu:** Không dùng Draft Version; validate cửa sổ thời gian và passingScore; chống race giữa start, chỉnh config và cancellation.

### F12 — Participant exam discovery

**Nguồn:** UC-PARTEXAM-01..06.  
**Phụ thuộc:** F11.

- [ ] My Exams có Upcoming, Available, Completed, Expired.
- [ ] Query theo quyền PUBLIC/CLASS/INDIVIDUAL, không fetch toàn bộ rồi lọc ở browser.
- [ ] Chi tiết trả thời gian, số câu, tổng điểm, lượt đã dùng và khả năng Start/Continue.
- [ ] Không gửi nội dung đề đầy đủ hoặc đáp án trước Start.
- [ ] Giữ đường truy cập lịch sử Attempt/Result dù membership sau này bị remove.

**API/UI:** Participant session list/detail; `/participant/exams`.

**Nghiệm thu:** PUBLIC yêu cầu login và role PARTICIPANT; membership không ACTIVE không cấp quyền start mới; tabs có thể giao nhau khi một Session đã hoàn thành nhưng còn lượt.

### F13 — Start, resume, stable shuffle và autosave

**Nguồn:** UC-PARTEXAM-07, UC-ATTEMPT-01..06, UC-SYSTEM-01.  
**Phụ thuộc:** F12.

- [ ] Start kiểm tra account, role, assignment, Session và giới hạn lượt bằng transaction.
- [ ] Ngăn duplicate active Attempt và vượt maxAttempts bằng khóa phù hợp cùng DB constraint.
- [ ] Lưu deadline, version và thứ tự question/option cụ thể khi Start.
- [ ] Resume khôi phục answers, review marks, order và deadline.
- [ ] Autosave validate owner, trạng thái, deadline, question/option thuộc snapshot.
- [ ] Dùng revision phía server để phát hiện cập nhật cũ; frontend tuần tự hóa/coalesce save theo câu.
- [ ] UI có navigation, review marks, timer theo server time và trạng thái dirty/saving/saved/failed.
- [ ] DTO làm bài không chứa correct answer, explanation hoặc grading metadata.
- [ ] Thu thập thời gian tương tác từng câu phục vụ analytics; đây là telemetry ước lượng, không dùng chấm điểm.

**API/UI:** Start/resume/read Attempt, save answer/review state; Exam Taking.

**Nghiệm thu:** Double-start trả cùng active Attempt; reload giữ shuffle; phản hồi save cũ không đánh dấu input mới là Saved; mất mạng hiển thị chưa lưu; remove khỏi lớp vẫn resume được Attempt đã bắt đầu.

### F14 — Submit, auto-finalize và automatic grading

**Nguồn:** UC-ATTEMPT-07, UC-SYSTEM-02, UC-GRADE-01.  
**Phụ thuộc:** F13.

- [ ] Manual submit và expiration dùng chung một nghiệp vụ finalize.
- [ ] Khóa Attempt khi finalize; ngăn autosave thay đổi dữ liệu đã dùng để chấm.
- [ ] Scheduler và lazy deadline check cùng gọi operation idempotent; xử lý lại các bài quá hạn sau restart.
- [ ] Chấm đúng snapshot: exact match, exact-set match, absolute tolerance; câu chưa trả lời 0 điểm.
- [ ] Dùng `BigDecimal`; pass/fail theo raw score, hiển thị hai chữ số HALF_UP.
- [ ] Lưu một Result cho mỗi Attempt, chi tiết điểm từng câu và lý do kết thúc để phân biệt submit/expired sau khi GRADED.
- [ ] Frontend đợi save được xác nhận trước submit; nếu timeout, fetch lại trạng thái authoritative.

**API/UI:** Submit command và finalization state; không trả điểm/đáp án vượt result policy trong response submit.

**Nghiệm thu:** Double-submit, submit-vs-expiration và save-vs-submit không chấm hai lần; backend vẫn finalize khi browser đóng; test biên tolerance và rounding.

### F15 — Result visibility, history và best score

**Nguồn:** UC-RESULT-01..03, UC-SESSION-08.  
**Phụ thuộc:** F14.

- [ ] Creator xem kết quả Session, danh sách Participant và toàn bộ Attempt.
- [ ] Participant xem history/detail theo cả display mode lẫn release policy.
- [ ] Backend tính BEST_SCORE trên các Attempt đã chấm; giữ đầy đủ lịch sử.
- [ ] Manual release idempotent và được audit.
- [ ] Bảo vệ policy trên mọi response liên quan: submit, history, Session detail, dashboard và notification.
- [ ] HIDDEN vẫn không trả điểm dù điều kiện release đã đạt; DETAILED mới cho xem đáp án/explanation.

**API/UI:** Participant results/history, Creator Session results, release-results.

**Nghiệm thu:** Test toàn bộ 4 display modes × 3 release policies, trước/sau điều kiện release; người khác không truy cập kết quả; gia hạn trước endTime làm thời điểm AFTER_SESSION_END theo endTime mới.

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

- [ ] Có mapping tới use case và screen flow.
- [ ] Feature có UI được thiết kế/review bằng UI/UX Pro Max theo Master và override phù hợp; kiểm tra semantic tokens, keyboard/focus, responsive, contrast và reduced motion.
- [ ] API, migration, backend và frontend nhất quán.
- [ ] Authorization, ownership, state và deadline được backend enforce.
- [ ] Các test quan trọng của feature pass; ghi rõ lệnh đã chạy.
- [ ] Không còn mock trong luồng thật.
- [ ] Tài liệu được đồng bộ; feature quan trọng có sơ đồ trong `docs/architecture/`.
- [ ] Không chứa secret hoặc sửa đè thay đổi đang có của người dùng.
- [ ] Có commit Conventional Commits sau khi feature hoàn thành.

Checkbox đã đánh dấu ở F01 phản ánh công việc đã triển khai và kiểm chứng nêu trên.
Các checkbox còn lại là công việc chưa hoàn thành; Definition of Done là checklist
áp dụng riêng cho từng feature, không phải xác nhận toàn bộ V1 đã hoàn tất.
