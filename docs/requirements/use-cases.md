# Learnova - Use Cases

> Phiên bản: V1  
> Nguồn nghiệp vụ: `business-requirements.md`
> Định hướng sản phẩm: **Online Assessment & Examination Platform**  
> Role chính thức: **PARTICIPANT**, **CREATOR**, **ADMIN**

---

# 1. Mục đích tài liệu

Tài liệu này là đặc tả Use Case chính thức cho Learnova V1.

Mục tiêu:

- Xác định rõ actor và quyền của từng actor.
- Chuyển nghiệp vụ thành các luồng có thể triển khai.
- Làm nguồn tham chiếu cho thiết kế màn hình.
- Làm nguồn tham chiếu cho thiết kế database.
- Làm nguồn tham chiếu cho OpenAPI Contract.
- Làm nguồn tham chiếu cho backend, frontend và test.
- Hạn chế việc AI Agent hoặc developer tự suy đoán nghiệp vụ.

Nguyên tắc:

> Nếu trong quá trình triển khai phát hiện business rule không còn phù hợp với thực tế, phải cập nhật lại tài liệu nghiệp vụ và tài liệu Use Case trước hoặc cùng lúc với thay đổi code.

---

# 2. Actor và Role

Learnova có ba role chính:

```text
PARTICIPANT
CREATOR
ADMIN
```

Ngoài ra có actor:

```text
GUEST
SYSTEM
```

## 2.1. PARTICIPANT

`PARTICIPANT` là người tham gia bài kiểm tra.

Có thể:

- Tham gia lớp.
- Xem kỳ thi được giao.
- Tham gia kỳ thi public.
- Làm bài.
- Autosave câu trả lời.
- Nộp bài.
- Xem kết quả theo chính sách của Creator.
- Xem lịch sử thi.
- Nhận thông báo.

## 2.2. CREATOR

`CREATOR` là người tạo và tổ chức bài kiểm tra.

Không bắt buộc phải là giáo viên.

Ví dụ:

- Giáo viên tạo đề cho học sinh.
- Sinh viên tạo quiz cho bạn bè.
- CLB tổ chức cuộc thi.
- Công ty tạo bài test.
- Cá nhân tạo bài đánh giá cho nhóm người khác.

Creator có thể:

- Quản lý lớp.
- Quản lý Question Bank.
- Import câu hỏi bằng Excel.
- Tạo Exam.
- Publish Exam Version.
- Tạo Exam Session.
- Giao kỳ thi.
- Theo dõi realtime.
- Xem kết quả.
- Xem Analytics.
- Export Excel.

## 2.3. ADMIN

`ADMIN` quản trị nền tảng.

Có thể:

- Quản lý tài khoản.
- Khóa / mở khóa tài khoản.
- Quản lý role thông thường.
- Xem thống kê hệ thống.
- Xem audit nghiệp vụ quan trọng khi cần.

## 2.4. Multi-role

Một User có thể đồng thời có:

```text
PARTICIPANT
CREATOR
```

Ví dụ:

```text
User A
├── PARTICIPANT
└── CREATOR
```

Người dùng có thể vừa tạo đề cho người khác vừa làm đề của Creator khác.

`ADMIN` không được tự cấp từ client.

---

# 3. Quy tắc đăng ký Role

Trong self-registration, người dùng có thể chọn:

```text
Làm bài kiểm tra
→ PARTICIPANT

Tạo và tổ chức bài kiểm tra
→ CREATOR

Cả hai
→ PARTICIPANT + CREATOR
```

`CREATOR` là self-service role và không yêu cầu Admin phê duyệt.

`ADMIN` không nằm trong self-registration flow.

Admin account được tạo/cấp quyền thông qua cơ chế quản trị an toàn, ví dụ:

- Bootstrap account.
- Seed account cho môi trường ban đầu.
- Quy trình quản trị nội bộ được bảo vệ.

---

# 4. Tổng quan Use Case

## 4.1. Guest

```text
UC-AUTH-01  Đăng ký tài khoản
UC-AUTH-02  Đăng nhập bằng email/password
UC-AUTH-03  Đăng nhập bằng Google
```

## 4.2. Participant

```text
UC-AUTH-04  Đăng xuất
UC-AUTH-05  Refresh phiên đăng nhập
UC-AUTH-06  Đăng xuất tất cả thiết bị

UC-USER-01  Xem hồ sơ cá nhân
UC-USER-02  Sửa hồ sơ cá nhân
UC-USER-03  Đổi mật khẩu

UC-CLASS-09  Tham gia lớp bằng mã
UC-CLASS-10  Xem lớp đang tham gia
UC-CLASS-11  Rời lớp

UC-PARTEXAM-01 Xem danh sách kỳ thi
UC-PARTEXAM-02 Xem kỳ thi sắp diễn ra
UC-PARTEXAM-03 Xem kỳ thi đang mở
UC-PARTEXAM-04 Xem kỳ thi đã hoàn thành
UC-PARTEXAM-05 Xem kỳ thi đã hết hạn
UC-PARTEXAM-06 Xem chi tiết kỳ thi
UC-PARTEXAM-07 Bắt đầu bài thi

UC-ATTEMPT-01 Xem câu hỏi
UC-ATTEMPT-02 Chọn / sửa đáp án
UC-ATTEMPT-03 Đánh dấu câu cần xem lại
UC-ATTEMPT-04 Xem trạng thái các câu
UC-ATTEMPT-05 Autosave câu trả lời
UC-ATTEMPT-06 Tiếp tục Attempt
UC-ATTEMPT-07 Nộp bài

UC-RESULT-02 Xem kết quả cá nhân
UC-RESULT-03 Xem lịch sử thi

UC-NOTI-01 Xem thông báo
UC-NOTI-02 Đánh dấu đã đọc
UC-NOTI-03 Đánh dấu tất cả đã đọc
```

## 4.3. Creator

```text
UC-AUTH-04  Đăng xuất
UC-AUTH-05  Refresh phiên đăng nhập
UC-AUTH-06  Đăng xuất tất cả thiết bị

UC-USER-01  Xem hồ sơ cá nhân
UC-USER-02  Sửa hồ sơ cá nhân
UC-USER-03  Đổi mật khẩu

UC-CLASS-01 Tạo lớp
UC-CLASS-02 Xem danh sách lớp
UC-CLASS-03 Xem chi tiết lớp
UC-CLASS-04 Cập nhật lớp
UC-CLASS-05 Thêm Participant
UC-CLASS-06 Xóa Participant khỏi lớp
UC-CLASS-07 Tạo / tạo lại Join Code
UC-CLASS-08 Xem thành viên

UC-QB-01 Tạo câu hỏi
UC-QB-02 Xem danh sách câu hỏi
UC-QB-03 Xem chi tiết câu hỏi
UC-QB-04 Sửa câu hỏi
UC-QB-05 Archive câu hỏi
UC-QB-06 Khôi phục câu hỏi Archived
UC-QB-07 Tìm kiếm / lọc / phân trang
UC-QB-08 Import Excel
UC-QB-09 Preview Import
UC-QB-10 Xác nhận Import

UC-EXAM-01 Tạo Exam
UC-EXAM-02 Xem danh sách Exam
UC-EXAM-03 Xem chi tiết Exam
UC-EXAM-04 Thêm câu hỏi vào Draft Version
UC-EXAM-05 Xóa câu hỏi khỏi Draft Version
UC-EXAM-06 Sắp xếp câu hỏi
UC-EXAM-07 Cấu hình điểm
UC-EXAM-08 Sinh câu hỏi theo rule
UC-EXAM-09 Publish Exam Version
UC-EXAM-10 Tạo Draft Version mới
UC-EXAM-11 Archive Exam

UC-SESSION-01 Tạo Exam Session
UC-SESSION-02 Xem danh sách Exam Session
UC-SESSION-03 Xem chi tiết Exam Session
UC-SESSION-04 Cập nhật Session
UC-SESSION-05 Giao kỳ thi theo Access Type
UC-SESSION-06 Cancel Session
UC-SESSION-07 Gia hạn End Time
UC-SESSION-08 Publish kết quả thủ công

UC-MON-01 Theo dõi Session realtime

UC-RESULT-01 Xem kết quả Session
UC-REPORT-01 Xem thống kê tổng quan
UC-REPORT-02 Xem Question Analytics
UC-REPORT-03 Export Excel

UC-NOTI-01 Xem thông báo
UC-NOTI-02 Đánh dấu đã đọc
UC-NOTI-03 Đánh dấu tất cả đã đọc
```

## 4.4. Admin

```text
UC-AUTH-04 Đăng xuất
UC-AUTH-05 Refresh phiên đăng nhập
UC-AUTH-06 Đăng xuất tất cả thiết bị

UC-USER-01 Xem hồ sơ cá nhân
UC-USER-02 Sửa hồ sơ cá nhân
UC-USER-03 Đổi mật khẩu

UC-ADMIN-01 Xem danh sách User
UC-ADMIN-02 Tìm kiếm User
UC-ADMIN-03 Lọc User
UC-ADMIN-04 Khóa User
UC-ADMIN-05 Mở khóa User
UC-ADMIN-06 Quản lý PARTICIPANT / CREATOR role
UC-ADMIN-07 Xem thống kê hệ thống
UC-ADMIN-08 Xem Audit Log quan trọng
```

---

# 5. Authentication & Authorization

## 5.1. Kiến trúc xác thực chính thức

Learnova sử dụng Hybrid Token Storage.

### Access Token

```text
Type: JWT
TTL: 15 phút
Transport: JSON response body
Frontend storage: In-Memory
Request usage: Authorization: Bearer <access-token>
```

Không lưu Access Token trong:

```text
localStorage
sessionStorage
```

### Refresh Token

```text
Type: Opaque cryptographically secure random token
TTL: 7 ngày
Transport: HttpOnly Cookie
Server-side storage: Redis
```

F03 dùng deadline session cố định 7 ngày từ login; rotation không kéo dài deadline.
Token USED được giữ đến cùng deadline để phát hiện reuse. Logout/revoke chỉ thu hồi
refresh session; JWT đã cấp còn hiệu lực đến expiry tối đa 15 phút, không cộng clock skew.
Frontend/API production cùng site, HTTPS, CORS allowlist và CSRF cookie/header cho POST auth.
Chi tiết: [kiến trúc F03](../architecture/f03-local-authentication.md).

Cookie production:

```text
HttpOnly = true
Secure = true
SameSite = Lax
Path = /api/v1/auth
```

### Redis Session

Redis lưu:

```text
userId
sessionId
familyId
refreshTokenHash
tokenStatus
createdAt
expiresAt
```

Không lưu raw Refresh Token.

Refresh token hash sử dụng SHA-256 hoặc hash một chiều phù hợp cho token ngẫu nhiên entropy cao.

### Refresh Token Rotation

Mỗi lần refresh thành công:

```text
RT1
 ↓
Validate
 ↓
RT1 = USED
 ↓
Generate RT2
 ↓
RT2 = ACTIVE
```

### Reuse Detection

Nếu RT cũ đã rotate bị sử dụng lại:

```text
Reuse Detected
      ↓
Revoke Token Family
      ↓
Yêu cầu đăng nhập lại session đó
```

### Atomic Rotation

Refresh validation + rotation phải atomic trong Redis để chống race condition.

Có thể dùng:

- Redis Lua script.
- Redis transaction phù hợp.

### Frontend Refresh Mutex

Nếu nhiều request cùng nhận `401`:

```text
Request A ─┐
Request B ─┼→ dùng chung một refresh Promise
Request C ─┘
```

Không được gọi nhiều `/refresh` đồng thời bằng cùng Refresh Token.

---

# 6. Authentication Use Cases

## UC-AUTH-01 - Đăng ký tài khoản

**Actor:** Guest

**Mục tiêu:**  
Tạo User mới và gán role self-service hợp lệ.

**Role được chọn:**

```text
PARTICIPANT
CREATOR
PARTICIPANT + CREATOR
```

**Luồng chính:**

1. Guest mở trang Register.
2. Nhập:
   - Email.
   - Password.
   - Display Name.
3. Chọn mục đích sử dụng.
4. Backend validate.
5. Backend kiểm tra email chưa tồn tại.
6. Backend hash password.
7. Tạo User.
8. Gán role được phép.
9. Trả kết quả đăng ký thành công.
10. Người dùng chuyển tới Login; đăng ký không tự tạo session.

**Business Rule:**

- Không nhận `ADMIN` từ request.
- Backend whitelist role được phép self-register.
- Password không lưu plaintext.
- Email được normalize theo rule hệ thống.
- F03 dùng strip/lowercase, không bỏ dấu chấm hoặc `+tag` trong email.
- Password từ 12–128 Unicode code point, giữ Unicode/khoảng trắng, không ép composition.
- Roles là danh sách không trùng PARTICIPANT, CREATOR hoặc cả hai.

---

## UC-AUTH-02 - Đăng nhập Local

**Actor:** Guest

**Luồng chính:**

1. Guest nhập email/password.
2. Backend xác thực credentials.
3. Kiểm tra User status.
4. Nếu `ACTIVE`, tạo authentication session.
5. Sinh `sessionId`.
6. Sinh `familyId`.
7. Sinh Refresh Token.
8. Hash Refresh Token.
9. Lưu session trong Redis.
10. Set Refresh Token bằng HttpOnly Cookie.
11. Sinh JWT Access Token 15 phút.
12. Trả Access Token và User summary bằng JSON.

**Ngoại lệ:**

- Sai credentials.
- Account `LOCKED`.
- Account `DISABLED`.

---

## UC-AUTH-03 - Đăng nhập bằng Google

**Actor:** Guest

**Phương án chính thức:**

### Google user chưa tồn tại

1. Google xác thực thành công.
2. Learnova nhận Google identity.
3. Nếu email Google verified và chưa thuộc User nào:
   - Tạo User mới.
   - Tạo `AuthIdentity(provider=GOOGLE)`.
4. User đi qua onboarding ngắn để chọn:
   - `PARTICIPANT`.
   - `CREATOR`.
   - Cả hai.
5. Tạo Learnova auth session.
6. Set Refresh Cookie.
7. Redirect về frontend.
8. Frontend gọi `/refresh` để nhận Access Token.

### Email đã tồn tại với Local Login

Learnova không tự link Google identity âm thầm.

Luồng:

1. Phát hiện email đã tồn tại.
2. Yêu cầu User xác thực account hiện tại.
3. Sau khi xác thực thành công, User xác nhận link Google.
4. Tạo thêm `AuthIdentity(provider=GOOGLE)` cho cùng User.

**Business Rule:**

- Không tạo duplicate User nếu cùng một account đã được link.
- Không truyền Learnova Access Token trong URL redirect.
- Google OAuth chỉ xác thực identity; Learnova vẫn dùng session/token riêng.
- User mới chưa onboarding không có Learnova session; đăng nhập lại resume cùng User.
- Email phải verified; Google `sub` là định danh ổn định. Không tự đổi email/profile/role
  của User đã link khi Google claims thay đổi.
- Mỗi User có tối đa một identity mỗi provider. Google-only email trùng nhưng subject
  khác bị từ chối; không tự gộp User.
- Link account có hai bước riêng: xác minh mật khẩu Local và xác nhận liên kết.
  Flow tạm hết hạn sau 10 phút; xác minh không gia hạn TTL, tối đa 5 lần mỗi flow.
- Hủy không xóa identity/User; mất response có thể đọc lại trạng thái hoặc đăng nhập
  Google lại để phục hồi. Account bị khóa/ngừng hoạt động không được cấp session.

---

## UC-AUTH-04 - Đăng xuất thiết bị hiện tại

**Actor:** Participant, Creator, Admin

**Luồng:**

1. Client gọi Logout.
2. Browser gửi Refresh Cookie.
3. Backend xác định session.
4. Revoke/delete session Redis.
5. Clear Refresh Cookie.
6. Frontend clear Access Token memory.

---

## UC-AUTH-05 - Refresh phiên đăng nhập

**Actor:** Participant, Creator, Admin

**Luồng:**

1. Frontend gọi `POST /api/v1/auth/refresh`.
2. Browser tự gửi HttpOnly Cookie.
3. Backend hash token.
4. Validate Redis session.
5. Kiểm tra User status.
6. Atomic rotation.
7. Mark old RT `USED`.
8. Sinh RT mới.
9. Lưu hash RT mới.
10. Set cookie mới.
11. Trả Access Token mới.

**Nếu reuse:**

```text
Old Refresh Token reused
      ↓
Revoke familyId
      ↓
401
      ↓
Login lại
```

---

## UC-AUTH-06 - Đăng xuất tất cả thiết bị

**Actor:** Participant, Creator, Admin

**Luồng:**

1. User yêu cầu logout all.
2. Backend xác định User.
3. Revoke toàn bộ auth session/family của User trong Redis.
4. Clear cookie hiện tại.
5. Frontend clear Access Token.

---

# 7. User Profile

## UC-USER-01 - Xem hồ sơ

**Actor:** Participant, Creator, Admin

Có thể xem:

```text
id
email
displayName
avatarUrl
roles
status
createdAt
```

---

## UC-USER-02 - Sửa hồ sơ

**Actor:** Participant, Creator, Admin

**Cho phép chỉnh:**

```text
displayName
avatarUrl
```

Email không sửa trực tiếp trong V1 vì thay đổi email cần verification flow riêng.

Role không chỉnh trong Profile endpoint.

Status không chỉnh từ User Profile.

F05: tên được strip và dài 1–100 Unicode code point. Avatar dùng URL HTTPS không chứa
thông tin đăng nhập; để trống/null để xóa. Backend không tải ảnh từ URL này.
Payload có field ngoài `displayName`, `avatarUrl` bị từ chối, không cập nhật một phần.

---

## UC-USER-03 - Đổi mật khẩu

**Actor:** User có Local AuthIdentity

**Luồng:**

1. Nhập mật khẩu hiện tại.
2. Nhập mật khẩu mới.
3. Backend verify mật khẩu hiện tại.
4. Validate password mới.
5. Hash password mới.
6. Cập nhật credentials.
7. Revoke các refresh session khác để tăng bảo mật.
8. Giữ refresh session hiện tại còn hoạt động, không gia hạn thời hạn session.

Mật khẩu mới dài 12–128 Unicode code point, giữ nguyên khoảng trắng. Sai mật khẩu hiện tại
không thay credentials hoặc revoke session. JWT của các phiên khác có thể còn hiệu lực tối đa
15 phút; refresh bị từ chối sau revoke. User phải ACTIVE và đã hoàn tất onboarding.
Redis lỗi ngăn commit mật khẩu; nếu DB rollback sau revoke, các session đã thu hồi không được phục hồi.

Google-only User chưa có Local Identity phải tạo password bằng flow riêng trước khi dùng chức năng này.

---

# 8. Classroom

## 8.1. Classroom Membership

Membership có trạng thái:

```text
ACTIVE
REMOVED
```

Không hard-delete membership đã có lịch sử liên quan.

---

## UC-CLASS-01 - Tạo lớp

**Actor:** Creator

**Dữ liệu tối thiểu:**

```text
name
description (optional)
```

Creator tạo lớp trở thành owner.

---

## UC-CLASS-02 - Xem danh sách lớp

**Actor:** Creator

Chỉ xem các lớp Creator sở hữu/quản lý trong V1.

---

## UC-CLASS-03 - Xem chi tiết lớp

**Actor:** Creator

Bao gồm:

```text
Thông tin lớp
Số thành viên
Join Code status
Danh sách Participant
Các Session liên quan
```

---

## UC-CLASS-04 - Cập nhật lớp

**Actor:** Creator

Cho phép cập nhật:

```text
name
description
```

---

## UC-CLASS-05 - Thêm Participant trực tiếp

**Actor:** Creator

**Phương án chính thức:**

- Creator tìm User bằng email.
- UI có thể hiển thị email/displayName.
- Backend nhận `userId` khi thêm membership.
- Chỉ User có role `PARTICIPANT` mới được thêm.
- Không dùng email làm foreign key.

Nếu User chưa tồn tại:

- Không tự tạo account.
- Creator có thể gửi Join Code cho người đó sau khi họ đăng ký.

---

## UC-CLASS-06 - Xóa Participant khỏi lớp

**Actor:** Creator

**Business Rule:**

- Membership chuyển `REMOVED`.
- Không xóa lịch sử Attempt/Result.
- Nếu Participant đang có Attempt `IN_PROGRESS` của Session được cấp quyền qua lớp:
  - Attempt hiện tại vẫn được hoàn tất.
  - Không tạo Attempt mới từ quyền membership đã bị remove.
- Kết quả lịch sử vẫn giữ nguyên.

---

## UC-CLASS-07 - Tạo / tạo lại Join Code

**Actor:** Creator

Join Code:

- Random và khó đoán.
- Có `expiresAt`.
- Mặc định hiệu lực 7 ngày.
- Creator có thể regenerate.
- Regenerate làm Join Code cũ không còn hợp lệ.
- Creator có thể revoke trước hạn.

---

## UC-CLASS-08 - Xem thành viên

**Actor:** Creator

Hỗ trợ:

- Search.
- Pagination.
- Lọc ACTIVE/REMOVED nếu cần audit.

---

## UC-CLASS-09 - Tham gia lớp bằng mã

**Actor:** Participant

**Luồng:**

1. Participant nhập Join Code.
2. Backend validate:
   - Code tồn tại.
   - Chưa expire.
   - Chưa revoke.
3. Nếu membership chưa tồn tại → tạo `ACTIVE`.
4. Nếu membership `REMOVED` và code còn hợp lệ → cho phép re-activate.
5. Nếu đang ACTIVE → trả trạng thái đã tham gia.

UI kiểm tra mã để xem trước tên/mô tả lớp và người tạo trước khi xác nhận tham gia.
Preview không tạo membership; backend kiểm tra lại hiệu lực mã tại lúc join.

---

## UC-CLASS-10 - Xem lớp đang tham gia

**Actor:** Participant

Chỉ hiển thị membership `ACTIVE`.

---

## UC-CLASS-11 - Rời lớp

**Actor:** Participant

**Rule:**

- Membership chuyển `REMOVED`.
- Attempt đang làm vẫn được hoàn tất.
- Không xóa lịch sử thi.
- Không tạo Attempt mới bằng quyền từ lớp sau khi rời.

---

# 9. Question Bank

## 9.1. Ownership

Mỗi Question thuộc một Creator.

Trong V1:

- Question private theo Creator.
- Creator khác không được sử dụng/sửa Question nếu không phải owner.
- Chưa triển khai Question Marketplace / Shared Question Bank.

## 9.2. Question Status

```text
DRAFT
ACTIVE
ARCHIVED
```

Ý nghĩa:

- `DRAFT`: đang soạn.
- `ACTIVE`: có thể đưa vào đề mới.
- `ARCHIVED`: không dùng cho đề mới nhưng giữ lịch sử.

Không hard-delete Question đã từng được sử dụng trong Exam Version.

---

## UC-QB-01 - Tạo câu hỏi

**Actor:** Creator

Loại V1:

```text
SINGLE_CHOICE
MULTIPLE_CHOICE
TRUE_FALSE
NUMERIC_ANSWER
```

Metadata:

```text
content
type
options
correctAnswer
explanation
difficulty
tag/topic
category
status
ownerId
createdAt
updatedAt
```

NUMERIC_ANSWER có:

```text
correctValue
tolerance
```

`tolerance` mặc định `0`.

---

## UC-QB-02 - Xem danh sách câu hỏi

**Actor:** Creator

Chỉ xem Question thuộc Creator hiện tại.

---

## UC-QB-03 - Xem chi tiết câu hỏi

**Actor:** Creator

---

## UC-QB-04 - Sửa câu hỏi

**Actor:** Creator

Cho phép sửa Question Bank hiện tại.

Không tác động Exam Version đã publish vì Exam Version sử dụng snapshot.

---

## UC-QB-05 - Archive câu hỏi

**Actor:** Creator

Nếu Question không còn dùng:

```text
ACTIVE / DRAFT
→ ARCHIVED
```

Không xóa dữ liệu lịch sử.

---

## UC-QB-06 - Khôi phục câu hỏi

**Actor:** Creator

```text
ARCHIVED
→ ACTIVE
```

sau khi validate nội dung vẫn hợp lệ. Nếu nội dung chưa hoàn chỉnh, khôi phục về
`DRAFT` để Creator tiếp tục soạn. Quyết định F07 ngày 01/10/2026 cho phép lưu nháp
thiếu nội dung/đáp án; không cho sửa trực tiếp câu ARCHIVED. ACTIVE được sửa với
validation đầy đủ và không hạ về DRAFT. Backend trả trạng thái thực tế sau restore.

---

## UC-QB-07 - Tìm kiếm / lọc / phân trang

**Actor:** Creator

Hỗ trợ:

```text
keyword
type
difficulty
tag
category
status
page
size
```

---

# 10. Excel Import Question Bank

## UC-QB-08 - Upload Excel

**Actor:** Creator

1. Upload `.xlsx`.
2. Backend kiểm tra loại file/kích thước.
3. Parse dữ liệu tạm.
4. Chưa import vào Question Bank ngay.

---

## UC-QB-09 - Preview Import

**Actor:** Creator

Hệ thống validate từng dòng.

Ví dụ:

```text
Total: 100
Valid: 94
Invalid: 6

Row 12: Missing correct answer
Row 37: Invalid question type
```

Preview phải cho thấy:

- Dòng hợp lệ.
- Dòng lỗi.
- Lý do lỗi.

---

## UC-QB-10 - Xác nhận Import

**Actor:** Creator

1. Creator xác nhận import.
2. Chỉ các row hợp lệ theo rule được import.
3. Import chạy transaction phù hợp.
4. Trả summary.

V1 ưu tiên:

> Nếu file có lỗi, Creator phải sửa hoặc xác nhận chỉ import các dòng hợp lệ theo UI được thiết kế rõ ràng. Không import âm thầm dữ liệu lỗi.

---

# 11. Exam Domain Model

Learnova tách:

```text
Exam
└── ExamVersion
```

`Exam` là identity logic của đề.

Ví dụ:

```text
Java OOP Midterm
```

`ExamVersion` là nội dung cụ thể của đề.

Ví dụ:

```text
Java OOP Midterm
├── Version 1
├── Version 2
└── Version 3
```

## 11.1. Exam Lifecycle

Exam có thể:

```text
ACTIVE
ARCHIVED
```

ExamVersion có:

```text
DRAFT
PUBLISHED
```

Rule:

```text
DRAFT
→ được chỉnh sửa

PUBLISHED
→ immutable
```

Muốn sửa nội dung đã publish:

```text
Create New Draft Version
```

---

# 12. Exam Builder Use Cases

## UC-EXAM-01 - Tạo Exam

**Actor:** Creator

1. Tạo Exam identity.
2. Tạo `ExamVersion 1` ở trạng thái `DRAFT`.
3. Creator bắt đầu thêm/cấu hình câu hỏi.

---

## UC-EXAM-02 - Xem danh sách Exam

**Actor:** Creator

Có thể lọc:

```text
ACTIVE
ARCHIVED
```

---

## UC-EXAM-03 - Xem chi tiết Exam

**Actor:** Creator

Hiển thị:

- Thông tin Exam.
- Danh sách version.
- Version hiện tại.
- Session sử dụng version.
- Trạng thái.

---

## UC-EXAM-04 - Thêm câu hỏi vào Draft Version

**Actor:** Creator

Chỉ thêm Question `ACTIVE` thuộc chính Creator.

Khi thêm vào Draft, dữ liệu cần thiết được chuẩn bị để khi publish tạo snapshot.

---

## UC-EXAM-05 - Xóa câu hỏi khỏi Draft Version

**Actor:** Creator

Không cho sửa version `PUBLISHED`.

---

## UC-EXAM-06 - Sắp xếp câu hỏi

**Actor:** Creator

Chỉ áp dụng Draft Version.

---

## UC-EXAM-07 - Cấu hình điểm

**Actor:** Creator

Điểm nằm trên từng Exam Question:

```text
ExamVersionQuestion
├── questionSnapshot
├── order
└── points
```

Tổng điểm:

```text
totalScore = SUM(question.points)
```

Không duy trì một totalScore độc lập dễ mất đồng bộ.

UI có thể hỗ trợ:

```text
Chia đều 10 điểm cho 40 câu
```

nhưng backend cuối cùng vẫn lưu points từng câu.

---

## UC-EXAM-08 - Sinh câu hỏi theo Rule

**Actor:** Creator

Rule có thể gồm:

```text
category/topic
difficulty
questionType
quantity
```

Flow:

1. Creator khai báo ma trận.
2. Backend tìm Candidate Questions.
3. Kiểm tra đủ số lượng.
4. Nếu thiếu → báo lỗi.
5. Nếu đủ → random selection.
6. Đưa kết quả vào Draft Version.
7. Creator được review trước khi publish.

---

## UC-EXAM-09 - Publish Exam Version

**Actor:** Creator

Khi publish:

1. Validate Draft.
2. Validate có câu hỏi.
3. Validate points hợp lệ.
4. Tạo/cố định snapshot của Question.
5. Version chuyển `PUBLISHED`.
6. Không được sửa nội dung version này.

Snapshot giữ tối thiểu dữ liệu cần cho:

- Hiển thị câu hỏi lúc thi.
- Chấm điểm.
- Review kết quả.
- Audit lịch sử.

---

## UC-EXAM-10 - Tạo Version mới

**Actor:** Creator

1. Chọn PUBLISHED Version làm base nếu muốn.
2. Hệ thống tạo version number tiếp theo.
3. New Version ở trạng thái `DRAFT`.
4. Creator sửa Draft.
5. Publish thành version mới.

Version number:

```text
1
2
3
...
```

Không overwrite version cũ.

---

## UC-EXAM-11 - Archive Exam

**Actor:** Creator

`ARCHIVED`:

- Không dùng để tạo Session mới.
- Các Session/Result lịch sử vẫn tồn tại.
- Không xóa version cũ.

---

# 13. Exam Session

Exam Session đại diện cho một lần tổ chức thi cụ thể.

Một Session luôn sử dụng **một ExamVersion đã PUBLISHED**.

## 13.1. Session Lifecycle

```text
DRAFT
  ↓
SCHEDULED
  ↓
OPEN
  ↓
CLOSED
```

Nhánh khác:

```text
DRAFT / SCHEDULED
→ CANCELLED
```

Ý nghĩa:

- `DRAFT`: đang cấu hình.
- `SCHEDULED`: đã sẵn sàng, chờ thời gian mở.
- `OPEN`: đang cho phép bắt đầu/làm bài.
- `CLOSED`: không nhận Attempt mới.
- `CANCELLED`: bị hủy.

Status có thể được derive một phần từ thời gian nhưng vẫn cần business state cho cancel/audit.

---

# 14. Exam Session Configuration

Một Session gồm:

```text
examVersionId
title/displayName
startTime
endTime
durationMinutes
maxAttempts
passingScore
accessType
shuffleQuestions
shuffleAnswers
resultDisplayMode
resultReleasePolicy
```

## 14.1. Passing Score

`passingScore` thuộc Exam Session.

Lý do:

Cùng Exam Version có thể được dùng cho nhiều Session với policy khác nhau.

Ví dụ:

```text
Practice Session
passingScore = 5

Official Session
passingScore = 7
```

---

# 15. Assignment / Access Type

Mỗi Session chỉ có **một** `accessType`:

```text
PUBLIC
CLASS
INDIVIDUAL
```

Không kết hợp nhiều loại trong cùng một Session ở V1.

## 15.1. PUBLIC

`PUBLIC` nghĩa là:

> Mọi User có role `PARTICIPANT` và đã đăng nhập đều có thể tham gia nếu Session đang hợp lệ.

Không hỗ trợ anonymous attempt trong V1.

## 15.2. CLASS

Session được assign cho một hoặc nhiều Classroom.

Participant được quyền nếu có membership `ACTIVE` trong ít nhất một class được assign.

## 15.3. INDIVIDUAL

Creator chọn một hoặc nhiều Participant cụ thể.

UI có thể search theo email/displayName.

Backend lưu quan hệ bằng:

```text
userId
```

không lưu email làm khóa liên kết.

---

# 16. Exam Session Use Cases

## UC-SESSION-01 - Tạo Session

**Actor:** Creator

1. Chọn PUBLISHED ExamVersion.
2. Nhập thời gian.
3. Nhập duration.
4. Max attempts.
5. Passing score.
6. Access Type.
7. Result policy.
8. Shuffle policy.
9. Lưu Draft.

---

## UC-SESSION-02 - Xem danh sách Session

**Actor:** Creator

Filter:

```text
DRAFT
SCHEDULED
OPEN
CLOSED
CANCELLED
```

---

## UC-SESSION-03 - Xem chi tiết Session

**Actor:** Creator

Hiển thị:

- Exam Version.
- Time window.
- Duration.
- Assignment.
- Attempt statistics.
- Result policy.
- Monitoring link nếu OPEN.

---

## UC-SESSION-04 - Cập nhật Session

**Actor:** Creator

### DRAFT

Cho phép sửa hầu hết config.

### SCHEDULED chưa có Attempt

Cho phép sửa config hợp lý trước khi mở.

### OPEN hoặc đã có Attempt

Khóa các field ảnh hưởng fairness:

```text
examVersionId
durationMinutes
maxAttempts
passingScore
accessType/assignment
shuffleQuestions
shuffleAnswers
scoring
```

Có thể thực hiện action riêng:

```text
Extend End Time
```

và phải audit.

---

## UC-SESSION-05 - Giao Session

**Actor:** Creator

Theo `accessType`:

### PUBLIC

Không cần assignment list.

### CLASS

Chọn N Classroom.

### INDIVIDUAL

Chọn N Participant.

---

## UC-SESSION-06 - Cancel Session

**Actor:** Creator

- Chỉ cho phép khi Session `DRAFT` hoặc `SCHEDULED` và chưa có Attempt.
- Creator xác nhận, backend kiểm tra lại ownership/state/Attempt trong transaction.
- Chuyển sang `CANCELLED` và ghi Audit Log cùng transaction.
- Participant không tạo Attempt mới.
- Từ chối nếu Session `OPEN`, `CLOSED`, `CANCELLED` hoặc đã có Attempt;
  confirmation không bỏ qua điều kiện này. Giữ nguyên Attempt/Result/history.

---

## UC-SESSION-07 - Gia hạn End Time

**Actor:** Creator

Có thể kéo dài `endTime` của Session.

Rule:

- Chỉ áp dụng cho Session `SCHEDULED` hoặc `OPEN`.
- `newEndTime > currentEndTime`; không rút ngắn thời gian.
- Phải audit:
  - oldEndTime.
  - newEndTime.
  - actor.
  - timestamp.

Deadline được lưu khi Start: `min(startedAt + duration, session.endTime)`.
Gia hạn không thay đổi deadline của Attempt đã bắt đầu và không mở lại Attempt
hoàn tất. Attempt mới dùng `endTime` mới; release policy `AFTER_SESSION_END`
cũng xét `endTime` mới.

---

## UC-SESSION-08 - Publish Result thủ công

**Actor:** Creator

Chỉ dùng khi:

```text
resultReleasePolicy = MANUAL
```

Sau khi publish:

- Participant được xem theo `resultDisplayMode`.

---

# 17. Result Visibility

Tách thành hai cấu hình.

## 17.1. Result Display Mode

```text
HIDDEN
SCORE_ONLY
SUMMARY
DETAILED
```

### HIDDEN

Participant chưa xem được kết quả.

### SCORE_ONLY

Hiển thị:

```text
score
pass/fail
```

### SUMMARY

Hiển thị:

```text
score
pass/fail
correctCount
incorrectCount
unansweredCount
duration
```

### DETAILED

Hiển thị thêm:

- Từng câu.
- Câu Participant đã chọn.
- Correct Answer.
- Explanation.

Chỉ hiển thị sau khi release policy cho phép.

## 17.2. Result Release Policy

```text
IMMEDIATE
AFTER_SESSION_END
MANUAL
```

### IMMEDIATE

Kết quả được xem ngay sau khi Attempt hoàn tất.

### AFTER_SESSION_END

Chỉ công bố sau `endTime`.

### MANUAL

Creator chủ động publish.

## 17.3. Default

```text
resultDisplayMode = SUMMARY
resultReleasePolicy = AFTER_SESSION_END
```

Default này giảm khả năng Participant thi sớm xem đáp án rồi chia sẻ cho người khác.

---

# 18. Participant Exam Discovery

## UC-PARTEXAM-01 - Xem danh sách kỳ thi

Nguồn quyền:

- PUBLIC.
- CLASS assignment.
- INDIVIDUAL assignment.

Không trả Session Participant không có quyền.

---

## UC-PARTEXAM-02 - Upcoming

Session Participant có quyền nhưng chưa tới `startTime`.

---

## UC-PARTEXAM-03 - Available

Session Participant có quyền và đang trong thời gian cho phép bắt đầu.

---

## UC-PARTEXAM-04 - Completed

Participant đã hoàn tất ít nhất một Attempt.

---

## UC-PARTEXAM-05 - Expired

Session đã đóng và Participant không còn khả năng tạo Attempt mới.

---

## UC-PARTEXAM-06 - Xem chi tiết kỳ thi

Có thể xem:

```text
title
description
startTime
endTime
duration
maxAttempts
attemptsUsed
totalQuestions
totalScore
result policy summary nếu phù hợp
```

Không trả correct answer.

---

## UC-PARTEXAM-07 - Bắt đầu bài thi

Backend kiểm tra:

```text
User ACTIVE?
Có role PARTICIPANT?
Có quyền với Session?
Session OPEN?
Đã quá endTime?
Còn attempt?
Có Attempt IN_PROGRESS?
```

Nếu có Attempt `IN_PROGRESS`:

- Trả lại Attempt hiện tại.
- Không tạo duplicate Attempt.

Nếu hợp lệ và chưa có Attempt:

1. Create Attempt.
2. `startedAt = server time`.
3. Tính và lưu cố định `deadline = min(startedAt + duration, session.endTime)`.
4. Chốt question order.
5. Chốt answer option order.
6. Trả Attempt view.

---

# 19. Attempt

## 19.1. Attempt Status

```text
IN_PROGRESS
SUBMITTED
EXPIRED
GRADED
```

## 19.2. Deadline

Backend là source of truth.

```text
attemptDeadline =
MIN(
    startedAt + duration,
    sessionEndTime theo policy
)
```

Không tin timer frontend.

---

# 20. Stable Shuffle

Nếu `shuffleQuestions = true`:

- Thứ tự được quyết định một lần khi Attempt bắt đầu.
- Lưu question order hoặc deterministic seed.
- Reload không shuffle lại.

Nếu `shuffleAnswers = true`:

- Option order cũng được chốt theo Attempt.
- Reload không đổi thứ tự.

---

# 21. Attempt Use Cases

## UC-ATTEMPT-01 - Xem câu hỏi

**Actor:** Participant

API trong active Attempt chỉ trả dữ liệu cần để làm bài.

Không trả:

```text
correctAnswer
isCorrect
explanation
internal grading rule nhạy cảm
```

---

## UC-ATTEMPT-02 - Chọn / sửa đáp án

**Actor:** Participant

Cho phép khi:

- Attempt `IN_PROGRESS`.
- Server deadline chưa hết.

---

## UC-ATTEMPT-03 - Đánh dấu Review

**Actor:** Participant

Mark-for-review là state hỗ trợ UX của Attempt.

Không ảnh hưởng scoring.

---

## UC-ATTEMPT-04 - Xem trạng thái câu

Có thể phân loại:

```text
ANSWERED
UNANSWERED
MARKED_FOR_REVIEW
```

---

## UC-ATTEMPT-05 - Autosave

Mỗi thay đổi đáp án:

```text
Participant
   ↓
Autosave
   ↓
Backend
   ↓
AttemptAnswer
```

Backend validate:

- Attempt owner.
- Attempt status.
- Deadline.
- Question thuộc Attempt.

Frontend có thể hiển thị:

```text
Saving...
Saved
Save failed
```

---

## UC-ATTEMPT-06 - Tiếp tục Attempt

Sau reload:

1. Frontend khôi phục authentication qua Refresh flow nếu cần.
2. Fetch Attempt đang `IN_PROGRESS`.
3. Backend trả:
   - Saved answers.
   - Question order.
   - Option order.
   - Server deadline.
4. Tiếp tục bài.

---

## UC-ATTEMPT-07 - Submit

Submit phải idempotent.

Tình huống:

```text
double click
retry
network resend
```

không được tạo:

```text
duplicate result
duplicate grading
duplicate submission
```

Nếu Attempt đã submit:

- Trả trạng thái hiện tại hoặc response idempotent phù hợp.
- Không chấm lại theo cách tạo side effect mới.

---

# 22. Auto Submit / Expiration

## UC-SYSTEM-01 - Server Deadline

**Actor:** System

Backend tính và lưu `deadline = min(startedAt + duration, session.endTime)` khi
Start Attempt. Resume/autosave/submit/auto-finalize dùng deadline đã lưu;
gia hạn Session không tính lại deadline hoặc mở lại Attempt đã hoàn tất.

---

## UC-SYSTEM-02 - Hết thời gian

Khi deadline reached:

```text
IN_PROGRESS
    ↓
EXPIRED / auto-finalize
    ↓
Grading
```

Hệ thống không phụ thuộc browser còn mở.

Có thể xử lý bằng:

- Scheduler.
- Lazy expiration khi request tiếp theo tới.
- Kết hợp cả hai.

Business result phải nhất quán dù browser mất kết nối.

---

# 23. Multiple Attempts

Exam Session có:

```text
maxAttempts >= 1
```

Tất cả Attempt đều được giữ lịch sử.

Overall result V1 sử dụng:

```text
BEST_SCORE
```

Ví dụ:

```text
Attempt 1 = 6.0
Attempt 2 = 9.0
Attempt 3 = 7.0

Overall = 9.0
```

Không xóa Attempt cũ.

Future có thể thêm:

```text
LATEST
FIRST
AVERAGE
```

nhưng V1 chỉ dùng `BEST_SCORE`.

---

# 24. Automatic Grading

## UC-GRADE-01 - Chấm điểm tự động

**Actor:** System

Flow:

```text
Attempt finalized
       ↓
Load Exam Snapshot
       ↓
Load Attempt Answers
       ↓
Grade each item
       ↓
Calculate raw score
       ↓
Compare passingScore
       ↓
Store Result
```

## 24.1. SINGLE_CHOICE

```text
Selected option == correct option
→ full points

otherwise
→ 0
```

## 24.2. TRUE_FALSE

```text
answer == correctAnswer
→ full points

otherwise
→ 0
```

## 24.3. MULTIPLE_CHOICE

V1 dùng exact-set match.

Ví dụ Correct:

```text
A C D
```

Participant:

```text
A C D
→ full points

A C
→ 0

A C D E
→ 0
```

Không partial score V1.

## 24.4. NUMERIC_ANSWER

Question lưu:

```text
correctValue
tolerance
```

Rule:

```text
ABS(participantValue - correctValue) <= tolerance
→ full points
```

Default:

```text
tolerance = 0
```

V1 chỉ dùng absolute tolerance.

Sử dụng `BigDecimal` cho tính toán số chính xác.

## 24.5. Negative Marking

V1 không có điểm âm.

Sai:

```text
0 points
```

## 24.6. Rounding

Backend tính raw score bằng precision đầy đủ.

Pass/Fail so sánh trên raw score.

Display/API presentation:

```text
2 decimal places
HALF_UP
```

Không round trước khi xác định Pass/Fail.

---

# 25. Result

## UC-RESULT-01 - Creator xem kết quả Session

**Actor:** Creator

Xem:

- Participant.
- Attempt count.
- Best score.
- Pass/Fail.
- Submission time.
- Duration.
- Chi tiết Attempts nếu cần.

---

## UC-RESULT-02 - Participant xem Result

**Actor:** Participant

Backend kiểm tra:

```text
resultReleasePolicy
+
resultDisplayMode
```

rồi mới trả dữ liệu tương ứng.

Correct Answer và Explanation không bao giờ được trả sớm hơn policy.

---

## UC-RESULT-03 - Lịch sử thi

**Actor:** Participant

Hiển thị:

```text
Exam
Session
Attempt count
Best score
Pass/Fail
Completed date
```

---

# 26. Realtime Monitoring

## UC-MON-01 - Theo dõi Session realtime

**Actor:** Creator

Có thể xem:

```text
Total Participants
Not Started
In Progress
Submitted
Disconnected
```

Mỗi Participant:

```text
displayName
status
answeredCount
totalQuestions
lastSeen
```

Event V1:

```text
CONNECTED
DISCONNECTED
STARTED
SUBMITTED
```

Có thể mở rộng:

```text
TAB_HIDDEN
FULLSCREEN_EXIT
```

Các browser event chỉ là tín hiệu hỗ trợ, không được coi là bằng chứng gian lận tuyệt đối.

WebSocket dùng để cập nhật realtime.

REST vẫn là source of truth cho dữ liệu persisted.

---

# 27. Reporting & Analytics

## UC-REPORT-01 - Thống kê tổng quan

**Actor:** Creator

Bao gồm:

```text
Average Score
Highest Score
Lowest Score
Pass Rate
Score Distribution
Completion Rate
```

---

## UC-REPORT-02 - Question Analytics

**Actor:** Creator

Cho từng snapshot question:

```text
Correct Rate
Incorrect Rate
Unanswered Rate
Average Answer Time
```

Có thể phát triển:

```text
Difficulty Index
Discrimination Index
```

Hai chỉ số nâng cao không bắt buộc V1.

Analytics phải dựa trên dữ liệu của đúng Exam Version/Session, không trộn dữ liệu Question Bank hiện tại với snapshot lịch sử.

---

## UC-REPORT-03 - Export Excel

**Actor:** Creator

Export `.xlsx`.

Dữ liệu tối thiểu:

```text
Participant
Email
Attempt Number
Best Score
Raw Score
Correct
Incorrect
Unanswered
Started At
Submitted At
Duration
Pass/Fail
```

---

# 28. Notification

## 28.1. V1 Core

In-app notification là bắt buộc.

Trigger chính:

```text
EXAM_ASSIGNED
EXAM_REMINDER
RESULT_RELEASED
CLASS_JOINED
```

## 28.2. Email Notification

Email là optional V1 / V1.1.

Ưu tiên email cho event:

```text
EXAM_ASSIGNED
EXAM_REMINDER
RESULT_RELEASED
```

Không gửi email cho event kỹ thuật như:

```text
AUTOSAVE
ATTEMPT_STARTED
WEBSOCKET_CONNECTED
```

Không cần RabbitMQ chỉ để gửi email ở giai đoạn đầu.

Có thể dùng Application/Domain Event trong modular monolith.

---

## UC-NOTI-01 - Xem thông báo

**Actor:** Participant, Creator

---

## UC-NOTI-02 - Đánh dấu đã đọc

**Actor:** Participant, Creator

---

## UC-NOTI-03 - Đánh dấu tất cả đã đọc

**Actor:** Participant, Creator

---

# 29. Admin

## UC-ADMIN-01 - Xem User

**Actor:** Admin

Hiển thị:

```text
email
displayName
roles
status
createdAt
lastLoginAt nếu có
```

---

## UC-ADMIN-02 - Tìm kiếm User

Search:

```text
email
displayName
```

---

## UC-ADMIN-03 - Lọc User

Filter:

```text
role
status
```

---

## UC-ADMIN-04 - Khóa tài khoản

**Actor:** Admin

Khi khóa:

```text
status = LOCKED
```

- Không cho login mới.
- Không cho refresh Access Token mới.
- Revoke refresh session của User.
- Access Token hiện tại có thể còn hiệu lực tối đa tới TTL; V1 chấp nhận trade-off JWT 15 phút.

---

## UC-ADMIN-05 - Mở khóa

```text
LOCKED
→ ACTIVE
```

Không tự restore refresh session cũ.

User phải login lại.

---

## UC-ADMIN-06 - Quản lý Role

Admin UI có thể quản lý:

```text
PARTICIPANT
CREATOR
```

Admin không cấp `ADMIN` qua UI thông thường.

Mọi role change quan trọng phải audit.

---

## UC-ADMIN-07 - Thống kê hệ thống

Có thể gồm:

```text
Total Users
Total Participants
Total Creators
Total Exams
Total Sessions
Active Users
```

---

## UC-ADMIN-08 - Xem Audit Log

Audit các hành động business-critical.

Ví dụ:

```text
ROLE_CHANGED
ACCOUNT_LOCKED
ACCOUNT_UNLOCKED
EXAM_VERSION_PUBLISHED
EXAM_ARCHIVED
SESSION_CREATED
SESSION_CANCELLED
SESSION_END_TIME_EXTENDED
RESULT_MANUALLY_RELEASED
```

Audit record tối thiểu:

```text
actorUserId
action
targetType
targetId
oldValue / metadata phù hợp
newValue / metadata phù hợp
timestamp
```

Không audit toàn bộ GET request.

---

# 30. Dashboard

Dashboard là read model tổng hợp, không phải domain độc lập.

## 30.1. Participant Dashboard

Hiển thị:

```text
Upcoming Exams
Available Exams
In-progress Attempt
Recently Completed
Recent Results
Average Score
Notifications
```

## 30.2. Creator Dashboard

Hiển thị:

```text
Total Questions
Total Exams
Active Sessions
Total Participants
Upcoming Sessions
Recent Exams
Recent Results
Question Bank Statistics
```

Quick actions:

```text
Create Question
Import Questions
Create Exam
Create Session
Open Monitoring
```

## 30.3. Admin Dashboard

Hiển thị:

```text
Total Users
Total Participants
Total Creators
Total Exams
Active Users
```

---

# 31. Business Rules chính thức

## BR-01 - Multi-role

User có thể đồng thời là `PARTICIPANT` và `CREATOR`.

## BR-02 - Creator self-service

Creator không cần Admin xác minh để được tạo đề.

## BR-03 - Admin protected

Client không được tự cấp role `ADMIN`.

## BR-04 - Backend authorization

Frontend không phải source of truth về quyền.

## BR-05 - Hybrid Auth

Access Token JWT 15 phút trong memory; Refresh Token opaque 7 ngày trong HttpOnly Cookie.

## BR-06 - Redis Session

Refresh session lưu Redis, chỉ lưu Refresh Token hash.

## BR-07 - Refresh Rotation

RTR bắt buộc.

## BR-08 - Refresh Reuse Detection

Reuse token cũ → revoke token family.

## BR-09 - Atomic Refresh

Refresh validation/rotation phải atomic.

## BR-10 - Question Ownership

Question private theo Creator trong V1.

## BR-11 - Question Archive

Question đã dùng không hard-delete khỏi lịch sử.

## BR-12 - Exam Version Immutable

Published Exam Version không sửa.

## BR-13 - New Version

Muốn thay đổi đề đã publish phải tạo Draft Version mới.

## BR-14 - Exam Snapshot

Question Bank thay đổi không làm thay đổi đề đã publish.

## BR-15 - Score per Question

Total score được derive từ tổng points của câu hỏi.

## BR-16 - Passing Score per Session

Passing score thuộc Exam Session.

## BR-17 - One Access Type

Một Session chỉ có một trong `PUBLIC`, `CLASS`, `INDIVIDUAL`.

## BR-18 - Public Requires Login

Public Exam V1 vẫn yêu cầu User có role Participant và đăng nhập.

## BR-19 - Session Lifecycle

Session dùng `DRAFT`, `SCHEDULED`, `OPEN`, `CLOSED`, `CANCELLED`.

## BR-20 - Lock Critical Session Config

Khi đã có Attempt, không sửa các field ảnh hưởng fairness trừ action đặc biệt có audit.

## BR-21 - Backend Deadline

Frontend timer chỉ hiển thị.

## BR-22 - Stable Shuffle

Shuffle chỉ xác định một lần cho mỗi Attempt.

## BR-23 - Autosave

Answer phải được lưu trong quá trình làm bài.

## BR-24 - Idempotent Submit

Duplicate submit không gây duplicate grading/result.

## BR-25 - Auto Finalize

Hết giờ phải được xử lý server-side.

## BR-26 - Best Score

Multiple attempts V1 lấy `BEST_SCORE`.

## BR-27 - Multiple Choice Exact Match

Không partial score V1.

## BR-28 - Numeric Tolerance

Numeric Answer hỗ trợ absolute tolerance bằng BigDecimal.

## BR-29 - No Negative Marking

V1 không điểm âm.

## BR-30 - Result Release

Result visibility phụ thuộc cả Display Mode và Release Policy.

## BR-31 - Default Result Policy

```text
SUMMARY + AFTER_SESSION_END
```

## BR-32 - Correct Answer Protection

Correct Answer/Explanation không gửi cho active Attempt.

## BR-33 - Import Preview

Excel phải Validate + Preview trước khi import.

## BR-34 - Preserve History

Remove Participant khỏi lớp, archive Question/Exam, lock User không được xóa dữ liệu thi lịch sử.

## BR-35 - Audit Critical Actions

Các thay đổi security/business quan trọng phải audit.

---

# 32. Kịch bản Demo End-to-End

```text
Creator Register / Login
        ↓
Create Classroom
        ↓
Generate Join Code
        ↓
Participant Join Class
        ↓
Creator Import Questions Excel
        ↓
Validate + Preview
        ↓
Confirm Import
        ↓
Create Exam
        ↓
Build Draft Version
        ↓
Generate / Select Questions
        ↓
Configure Points
        ↓
Publish Exam Version
        ↓
Create Exam Session
        ↓
Choose CLASS Access
        ↓
Configure Time / Duration / Attempts / Result Policy
        ↓
Schedule Session
        ↓
Participant Login
        ↓
View Available Exam
        ↓
Start Attempt
        ↓
Stable Shuffle + Server Deadline
        ↓
Answer + Autosave
        ↓
Creator Realtime Monitoring
        ↓
Participant Submit
        ↓
Idempotent Finalization
        ↓
Automatic Grading
        ↓
Session Ends
        ↓
Result Released
        ↓
Participant View Summary
        ↓
Creator View Score Distribution
        ↓
Creator View Question Analytics
        ↓
Export Excel
```

---

# 33. Scope V1

## Bắt buộc

```text
Authentication
Google Login
Multi-role
Classroom
Question Bank
Excel Import
Exam Versioning
Exam Session
Public / Class / Individual Assignment
Attempt
Autosave
Server Deadline
Stable Shuffle
Idempotent Submit
Automatic Grading
Result Visibility
Realtime Monitoring
Reporting & Analytics
Excel Export
In-app Notification
Admin User Management
Audit Critical Actions
```

## Optional V1 / V1.1

```text
Email Notification
Difficulty Index
Discrimination Index
Advanced browser monitoring
```

## Future Scope

```text
Anonymous Public Exam
Essay
Manual Grading
Partial Score
Negative Marking
Question Sharing Marketplace
AI Question Generation
AI Tutor
Payment
Course / Lesson LMS
Camera Proctoring
Face Recognition
Microservices
RabbitMQ
Advanced Anti-Cheat
```

---

# 34. Nguyên tắc triển khai

Thứ tự ưu tiên:

```text
Correct Business Rule
        ↓
Data Integrity
        ↓
Security
        ↓
Consistency
        ↓
Reliability
        ↓
Maintainability
        ↓
Performance
```

Không tối ưu sớm bằng cách làm mất tính đúng đắn của nghiệp vụ.

Không thêm công nghệ chỉ để làm portfolio.

Ví dụ:

- Redis được dùng vì có use case thực tế cho Refresh Session.
- WebSocket được dùng vì có Realtime Monitoring.
- RabbitMQ chỉ thêm khi có nhu cầu async/event đáng kể thực sự.
- Microservices không dùng trong V1.

---

# 35. Bước tiếp theo

Thực hiện chuỗi sau cho từng feature theo dependency của [kế hoạch V1](../plans/v1-feature-implementation-plan.md):

```text
use-cases.md
      ↓
screen-flow.md
      ↓
UI/UX Pro Max: thiết kế UI của feature
      ↓
ERD / Data Model
      ↓
OpenAPI Contract
      ↓
Backend Implementation
      ↓
Frontend Integration
      ↓
Tests
```

`screen-flow.md` phải ánh xạ trực tiếp từ Use Case trong tài liệu này.

Đọc [workflow UI/UX Pro Max](../architecture/ui-ux-workflow.md) để tra cứu, sử dụng design system và kiểm tra UX. Mock chỉ phục vụ thiết kế; feature hoàn chỉnh phải tích hợp API thật. Không chờ hoàn thiện toàn bộ UI mới triển khai backend.

Không tạo màn hình chỉ vì gợi ý thiết kế nếu màn hình đó không phục vụ nghiệp vụ đã chốt.

---

# 36. Tóm tắt Business Core

Learnova V1 tập trung vào:

> **Tạo câu hỏi → Tạo và version hóa đề → Tổ chức kỳ thi → Làm bài an toàn → Chấm điểm → Giám sát realtime → Công bố kết quả → Phân tích dữ liệu.**

Đây là business core của V1.
