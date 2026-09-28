# Learnova - Business Requirements

> Phiên bản: V1  
> Định hướng sản phẩm: **Online Assessment & Examination Platform**  
> Tài liệu này mô tả **WHAT + WHY** của hệ thống: Learnova phải hỗ trợ nghiệp vụ gì và các business rule nào phải đúng.  
> Luồng tương tác chi tiết của actor được mô tả trong `use-cases.md`.

---

# 1. Tổng quan đề tài

Learnova là nền tảng kiểm tra và đánh giá trực tuyến, tập trung vào một business core duy nhất:

> **Tạo câu hỏi → Tạo và version hóa đề → Tổ chức kỳ thi → Làm bài → Chấm điểm → Giám sát realtime → Công bố kết quả → Phân tích dữ liệu.**

Learnova hỗ trợ:

- Quản lý người dùng và phân quyền.
- Quản lý nhóm/lớp phục vụ việc giao bài kiểm tra.
- Xây dựng và quản lý Question Bank.
- Import câu hỏi bằng Excel.
- Tạo đề thi.
- Sinh đề từ Question Bank theo rule.
- Version hóa đề thi.
- Tổ chức Exam Session.
- Giao kỳ thi theo phạm vi Public / Class / Individual.
- Làm bài với autosave.
- Kiểm soát deadline phía server.
- Tự động hoàn tất bài khi hết giờ.
- Chấm điểm tự động.
- Theo dõi người làm bài theo thời gian thực.
- Công bố kết quả theo policy.
- Báo cáo và phân tích kết quả.
- Export Excel.
- In-app notification.
- Quản trị tài khoản.

Learnova **không phải LMS** trong V1.

Không tập trung vào:

```text
Course
Lesson
Enrollment
Learning Progress
Certificate
Video Learning
Payment
Chat
Forum
```

---

# 2. Vai trò người dùng

Learnova sử dụng ba role chính:

```text
PARTICIPANT
CREATOR
ADMIN
```

Ngoài ra có:

```text
GUEST
SYSTEM
```

để mô tả người chưa đăng nhập và các xử lý tự động của hệ thống.

---

## 2.1. PARTICIPANT

`PARTICIPANT` là người tham gia bài kiểm tra.

Không bắt buộc phải là học sinh/sinh viên.

Participant có thể:

- Tham gia Classroom.
- Xem kỳ thi được giao.
- Xem kỳ thi Public.
- Bắt đầu bài thi.
- Trả lời câu hỏi.
- Đánh dấu câu cần xem lại.
- Được autosave câu trả lời.
- Tiếp tục Attempt đang làm.
- Nộp bài.
- Được hệ thống xử lý khi hết thời gian.
- Xem kết quả theo policy của Creator.
- Xem lịch sử thi.
- Nhận notification.

---

## 2.2. CREATOR

`CREATOR` là người tạo và tổ chức bài kiểm tra.

Creator không đồng nghĩa với giáo viên.

Ví dụ:

- Giáo viên tạo đề cho học sinh.
- Sinh viên tạo quiz cho bạn bè.
- CLB tổ chức cuộc thi.
- Công ty tạo bài đánh giá.
- Cá nhân tạo đề cho nhóm người khác.

Creator có thể:

- Quản lý Classroom.
- Quản lý Participant trong Classroom.
- Tạo và quản lý Question Bank.
- Import câu hỏi bằng Excel.
- Tạo Exam.
- Sinh câu hỏi theo rule.
- Version hóa Exam.
- Tạo Exam Session.
- Giao kỳ thi.
- Theo dõi realtime.
- Xem Result.
- Xem Report & Analytics.
- Export Excel.
- Nhận notification.

---

## 2.3. ADMIN

Admin quản trị nền tảng ở mức hệ thống.

Admin có thể:

- Xem danh sách User.
- Tìm kiếm User.
- Lọc theo role/status.
- Khóa tài khoản.
- Mở khóa tài khoản.
- Quản lý role `PARTICIPANT` / `CREATOR`.
- Xem thống kê tổng quan.
- Xem Audit Log của các hành động nghiệp vụ quan trọng.

`ADMIN` không nằm trong self-registration flow thông thường.

---

# 3. Multi-role

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

Người dùng có thể vừa tạo đề cho người khác vừa tham gia đề của Creator khác.

`ADMIN` không được tự cấp từ phía client.

---

# 4. Luồng nghiệp vụ tổng thể

Luồng nghiệp vụ chính:

```text
Creator
   ↓
Tạo Classroom
   ↓
Participant tham gia Classroom
   ↓
Tạo / Import Question Bank
   ↓
Tạo Exam
   ↓
Tạo Draft Exam Version
   ↓
Chọn / Sinh câu hỏi
   ↓
Cấu hình điểm
   ↓
Publish Exam Version
   ↓
Tạo Exam Session
   ↓
Cấu hình Assignment + Time + Attempts + Result Policy
   ↓
Participant bắt đầu làm bài
   ↓
Autosave
   ↓
Creator theo dõi realtime
   ↓
Participant Submit / System auto-finalize khi hết giờ
   ↓
Automatic Grading
   ↓
Result Release
   ↓
Participant xem kết quả
   ↓
Creator xem Analytics
   ↓
Export Excel
```

---

# 5. Identity & User

## 5.1. Đăng ký tài khoản

Người dùng tự đăng ký có thể chọn:

```text
Làm bài kiểm tra
→ PARTICIPANT

Tạo và tổ chức bài kiểm tra
→ CREATOR

Cả hai
→ PARTICIPANT + CREATOR
```

Business Rule:

- `CREATOR` là self-service role.
- Không yêu cầu Admin phê duyệt để tạo đề.
- `ADMIN` không được chọn trong self-registration.
- Backend phải whitelist role hợp lệ.
- Client không được tự gán quyền ngoài rule.

---

## 5.2. Đăng nhập

Hệ thống hỗ trợ:

- Email/password.
- Google Login.

Sau khi xác thực thành công, User được truy cập theo các role hiện có.

---

## 5.3. Google Login

Google Login là một phương thức xác thực danh tính.

### Google User mới

Nếu Google identity hợp lệ và chưa thuộc User nào:

- Learnova tạo User.
- User thực hiện onboarding.
- User chọn `PARTICIPANT`, `CREATOR` hoặc cả hai.
- Chưa hoàn tất onboarding thì chưa cấp Learnova session và chưa truy cập nghiệp vụ.
  Đăng nhập Google lần sau tiếp tục onboarding của cùng User; không tạo User mới.

### Email đã tồn tại với Local Login

Hệ thống không được tự link âm thầm.

User phải:

1. Xác thực account hiện tại.
2. Xác nhận link Google.
3. Sau đó Google identity mới được gắn vào cùng User.

Identity Google được nhận diện bằng provider `sub`; email phải được Google xác minh.
Identity đã link luôn dùng cùng User, không tự cập nhật email Learnova khi Google email
thay đổi. V1 mỗi User có tối đa một identity mỗi provider. Nếu email đã thuộc Google-only
User nhưng `sub` khác, từ chối liên kết; không suy ra quyền sở hữu chỉ từ email.
Hủy hoặc hết hạn flow không xóa User/identity đã tạo.

Mục tiêu:

- Tránh duplicate account.
- Tránh account takeover.
- Một User có thể sử dụng nhiều phương thức đăng nhập.

---

## 5.4. Phiên đăng nhập

Yêu cầu nghiệp vụ/bảo mật:

- Access session có thời gian sống ngắn.
- Refresh session có thời gian sống dài hơn.
- Refresh Token phải được rotate khi sử dụng.
- Token cũ không được tái sử dụng hợp lệ.
- Nếu phát hiện reuse phải vô hiệu hóa session family tương ứng.
- Logout phải vô hiệu hóa session hiện tại.
- Hệ thống phải hỗ trợ logout toàn bộ thiết bị.
- User `LOCKED` hoặc `DISABLED` không được tiếp tục refresh phiên mới.

Chi tiết kỹ thuật được mô tả trong `use-cases.md` và tài liệu architecture/security.

---

## 5.5. Trạng thái tài khoản

```text
ACTIVE
LOCKED
DISABLED
```

Backend là source of truth cho authorization.

Frontend không được tự quyết định quyền truy cập.

---

## 5.6. Profile

V1 cho phép User chỉnh:

```text
displayName
avatarUrl
```

Email không đổi trực tiếp trong V1 vì cần verification flow riêng.

Role không chỉnh trong Profile endpoint.

Status không chỉnh từ Profile.

---

# 6. Classroom

Classroom dùng để quản lý nhóm Participant phục vụ việc giao kỳ thi.

Mục tiêu chính:

> **Participant nào được phép tham gia Session nào?**

---

## 6.1. Classroom Membership

Membership có trạng thái:

```text
ACTIVE
REMOVED
```

Không hard-delete membership đã có dữ liệu lịch sử.

---

## 6.2. Creator có thể

- Tạo Classroom.
- Cập nhật tên/mô tả.
- Xem danh sách lớp.
- Xem chi tiết lớp.
- Thêm Participant.
- Xóa Participant khỏi lớp.
- Tạo Join Code.
- Regenerate Join Code.
- Revoke Join Code.
- Xem danh sách thành viên.

---

## 6.3. Thêm Participant trực tiếp

Creator tìm User bằng email.

UI có thể hiển thị:

```text
email
displayName
```

Backend lưu quan hệ bằng:

```text
userId
```

Không dùng email làm foreign key.

Nếu User chưa tồn tại:

- Không tự tạo account.
- Creator dùng Join Code để mời sau khi người đó đăng ký.

---

## 6.4. Join Code

Join Code phải:

- Random và khó đoán.
- Có `expiresAt`.
- Mặc định hiệu lực 7 ngày.
- Có thể regenerate.
- Có thể revoke trước hạn.

Regenerate làm code cũ mất hiệu lực.

---

## 6.5. Remove / Leave Classroom

Khi Participant bị remove hoặc tự rời lớp:

- Membership chuyển `REMOVED`.
- Không xóa lịch sử Attempt/Result.
- Attempt `IN_PROGRESS` đã bắt đầu vẫn được phép hoàn tất.
- Không tạo Attempt mới dựa trên quyền từ Classroom đó.

---

# 7. Question Bank

Question Bank là một trong các module trung tâm của Learnova.

---

## 7.1. Loại câu hỏi V1

```text
SINGLE_CHOICE
MULTIPLE_CHOICE
TRUE_FALSE
NUMERIC_ANSWER
```

Không triển khai Essay trong V1.

---

## 7.2. Ownership

Mỗi Question thuộc một Creator.

V1:

- Question private theo Creator.
- Creator khác không được sửa/sử dụng Question nếu không phải owner.
- Chưa triển khai Shared Question Bank / Marketplace.

---

## 7.3. Trạng thái Question

```text
DRAFT
ACTIVE
ARCHIVED
```

Ý nghĩa:

- `DRAFT`: đang soạn.
- `ACTIVE`: có thể sử dụng cho đề mới.
- `ARCHIVED`: không dùng cho đề mới nhưng vẫn giữ lịch sử.

Question đã từng được sử dụng không được hard-delete làm mất lịch sử.

---

## 7.4. Thông tin Question

Có thể gồm:

```text
content
type
options
correctAnswer
explanation
difficulty
tag/topic
category
owner
status
createdAt
updatedAt
```

NUMERIC_ANSWER có:

```text
correctValue
tolerance
```

`tolerance` mặc định:

```text
0
```

---

## 7.5. Creator có thể

- Tạo Question.
- Xem danh sách.
- Xem chi tiết.
- Sửa Question.
- Archive.
- Restore Archived Question.
- Tìm kiếm.
- Lọc.
- Phân trang.
- Đưa Question vào Draft Exam Version.

Question Bank thay đổi sau này không được làm thay đổi Exam Version đã publish.

---

# 8. Import Question bằng Excel

Creator có thể import số lượng lớn Question.

Flow:

```text
Upload Excel
    ↓
Parse
    ↓
Validate từng dòng
    ↓
Preview
    ↓
Hiển thị lỗi
    ↓
Creator xác nhận
    ↓
Import
```

Business Rule:

- Không import trực tiếp khi vừa upload.
- Phải validate từng dòng.
- Phải cho biết row nào lỗi.
- Không import âm thầm dữ liệu lỗi.
- Creator phải xác nhận trước khi dữ liệu thật được tạo.

Ví dụ:

```text
Total: 100
Valid: 94
Invalid: 6

Row 12: Missing correct answer
Row 37: Invalid question type
```

---

# 9. Exam & Exam Version

Learnova tách:

```text
Exam
└── ExamVersion
```

`Exam` đại diện cho identity logic của đề.

Ví dụ:

```text
Java OOP Midterm
```

`ExamVersion` đại diện cho nội dung cụ thể.

Ví dụ:

```text
Java OOP Midterm
├── Version 1
├── Version 2
└── Version 3
```

---

## 9.1. Exam Status

```text
ACTIVE
ARCHIVED
```

Exam `ARCHIVED`:

- Không dùng để tạo Session mới.
- Không xóa version/session/result lịch sử.

---

## 9.2. Exam Version Status

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

Muốn thay đổi nội dung đã publish:

```text
Create New Draft Version
```

Không overwrite version cũ.

---

# 10. Exam Snapshot / Versioning

Đây là business rule bắt buộc.

Khi publish:

```text
Question Bank
      ↓
Exam Draft Version
      ↓
Publish
      ↓
Immutable Exam Version / Snapshot
```

Nếu Question Bank thay đổi sau đó:

```text
Question mới
```

thì:

```text
Published Exam Version cũ
```

không thay đổi.

Mục tiêu:

- Bảo vệ dữ liệu lịch sử.
- Đảm bảo Result có thể kiểm chứng.
- Không để sửa Question Bank làm thay đổi đề đã thi.
- Đảm bảo grading luôn dùng đúng nội dung tại thời điểm thi.

---

# 11. Exam Builder

Creator có thể:

- Tạo Exam.
- Tạo Draft Version.
- Thêm Question.
- Xóa Question.
- Sắp xếp Question.
- Cấu hình điểm.
- Sinh Question theo rule.
- Publish Version.
- Tạo version mới.

---

## 11.1. Sinh Question theo Rule

Rule có thể dựa trên:

```text
category/topic
difficulty
questionType
quantity
```

Ví dụ:

```text
Java OOP

EASY       10
MEDIUM     15
HARD        5

SQL

EASY        5
MEDIUM      5
```

Nếu Question Bank không đủ Question phù hợp:

- Không âm thầm tạo đề thiếu.
- Hệ thống phải báo rõ thiếu điều kiện nào/số lượng nào.

Creator được review kết quả trước publish.

---

# 12. Điểm của đề

Điểm được cấu hình trên từng Question trong Exam Version.

Ví dụ:

```text
Question 1: 0.25
Question 2: 0.25
Question 3: 0.50
```

Tổng điểm:

```text
totalScore = SUM(question.points)
```

Không duy trì một giá trị tổng độc lập dễ mất đồng bộ.

UI có thể hỗ trợ thao tác:

```text
Chia đều 10 điểm cho 40 câu
```

nhưng business data cuối cùng vẫn là points từng Question.

---

# 13. Exam Session

Exam Session là một lần tổ chức kỳ thi cụ thể.

Một Exam Session luôn sử dụng:

> **Một ExamVersion đã PUBLISHED.**

---

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

Nhánh hủy:

```text
DRAFT / SCHEDULED
→ CANCELLED
```

Chỉ hủy Session `DRAFT` hoặc `SCHEDULED` chưa có Attempt. Không cho hủy
Session `OPEN`, `CLOSED`, `CANCELLED` hoặc đã có Attempt. Backend kiểm tra
lại state và sự tồn tại của Attempt trong transaction; ghi audit khi hủy.

Ý nghĩa:

- `DRAFT`: đang cấu hình.
- `SCHEDULED`: đã sẵn sàng, chờ thời điểm mở.
- `OPEN`: Participant được phép bắt đầu/làm bài.
- `CLOSED`: không nhận Attempt mới.
- `CANCELLED`: Session bị hủy.

---

## 13.2. Cấu hình Session

Session gồm:

```text
examVersion
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

---

# 14. Passing Score

`passingScore` thuộc:

```text
Exam Session
```

không thuộc Exam Version.

Lý do:

Cùng một đề có thể được dùng trong các Session khác nhau.

Ví dụ:

```text
Practice Session
passingScore = 5

Official Session
passingScore = 7
```

Exam Version chứa **nội dung**.

Exam Session chứa **chính sách tổ chức kỳ thi**.

---

# 15. Assignment / Access Type

Một Session chỉ có **một** Access Type:

```text
PUBLIC
CLASS
INDIVIDUAL
```

Không kết hợp nhiều loại trong cùng một Session ở V1.

---

## 15.1. PUBLIC

Public nghĩa là:

> Mọi User có role `PARTICIPANT` và đã đăng nhập đều có thể tham gia nếu Session đang hợp lệ.

V1 không hỗ trợ anonymous attempt.

---

## 15.2. CLASS

Creator assign Session cho:

```text
1 hoặc nhiều Classroom
```

Participant được quyền nếu có membership `ACTIVE` trong ít nhất một Classroom được assign.

---

## 15.3. INDIVIDUAL

Creator chọn:

```text
1 hoặc nhiều Participant
```

UI có thể search theo email/displayName.

Backend lưu bằng:

```text
userId
```

---

# 16. Chỉnh sửa Session

## 16.1. DRAFT

Được phép chỉnh hầu hết config.

## 16.2. SCHEDULED chưa có Attempt

Được phép chỉnh các cấu hình hợp lý trước khi mở.

## 16.3. OPEN hoặc đã có Attempt

Không được sửa các field ảnh hưởng fairness:

```text
examVersion
duration
maxAttempts
passingScore
assignment/accessType
shuffle policy
scoring
```

Có thể có action đặc biệt:

```text
Extend End Time
```

Action đặc biệt phải được audit.

Gia hạn chỉ được thực hiện khi Session `SCHEDULED` hoặc `OPEN`, với
`newEndTime > currentEndTime`. Gia hạn không thay đổi deadline đã lưu của
Attempt đang làm và không mở lại Attempt đã hoàn tất. Attempt bắt đầu sau
gia hạn dùng `endTime` mới; `AFTER_SESSION_END` cũng xét `endTime` mới.

---

# 17. Điều kiện bắt đầu bài thi

Khi Participant yêu cầu Start Exam, backend phải kiểm tra:

```text
Account ACTIVE?
Có role PARTICIPANT?
Có quyền với Session?
Session đang OPEN?
Chưa quá endTime?
Còn lượt Attempt?
Có Attempt IN_PROGRESS không?
```

Nếu đã có Attempt `IN_PROGRESS`:

- Trả lại Attempt hiện tại.
- Không tạo duplicate Attempt.

Frontend không được tự quyết định các rule này.

---

# 18. Attempt

Attempt đại diện cho một lần Participant làm bài.

---

## 18.1. Attempt Status

```text
IN_PROGRESS
SUBMITTED
EXPIRED
GRADED
```

---

## 18.2. Attempt Data

Có thể gồm:

```text
participant
session
examVersion
startedAt
deadline
submittedAt
status
score
answers
```

---

# 19. Server-side Deadline

Frontend timer chỉ để hiển thị.

Backend là source of truth.

Deadline được tính và lưu cố định khi bắt đầu Attempt:

```text
MIN(
    startedAt + duration,
    session.endTime tại thời điểm bắt đầu
)
```

Việc sửa JavaScript timer trên browser không làm thay đổi deadline thật.

Resume/autosave/submit/auto-finalize dùng deadline đã lưu. Gia hạn Session
không tính lại deadline của Attempt đã bắt đầu và không mở lại Attempt hoàn tất.

---

# 20. Stable Shuffle

Nếu:

```text
shuffleQuestions = true
```

thứ tự Question được quyết định **một lần** khi Attempt bắt đầu.

Nếu:

```text
shuffleAnswers = true
```

thứ tự option cũng được quyết định **một lần**.

Reload browser không được shuffle lại.

Hệ thống phải lưu:

- Order cụ thể.
- Hoặc deterministic seed đủ để tái tạo đúng order.

---

# 21. Làm bài thi

Participant có thể:

- Xem Question.
- Chọn đáp án.
- Sửa đáp án.
- Đi tới Question khác.
- Đánh dấu cần review.
- Xem Answered / Unanswered / Marked.
- Submit.

Trong Active Attempt, API không được trả:

```text
correctAnswer
isCorrect
explanation
internal grading data nhạy cảm
```

Correct Answer chỉ được công bố nếu Result Policy cho phép.

---

# 22. Autosave

Mỗi khi Participant thay đổi đáp án:

```text
Participant
   ↓
Autosave
   ↓
Backend
   ↓
AttemptAnswer
```

Mục tiêu:

- Không mất dữ liệu khi reload.
- Không mất dữ liệu nếu browser crash.
- Có thể tiếp tục Attempt.
- Giảm rủi ro mất toàn bộ dữ liệu khi submit cuối.

Frontend có thể hiển thị:

```text
Saving...
Saved
Save failed
```

Backend mới là source of truth về answer.

---

# 23. Idempotent Submit

Submit phải an toàn với:

```text
Double Click
Browser Retry
Network Retry
Request gửi lại
```

Không được tạo:

```text
2 Result
2 lần Grading
2 Submission side effect
```

Một Attempt chỉ được finalize đúng một lần về mặt nghiệp vụ.

---

# 24. Auto Finalize / Expiration

Khi deadline hết:

```text
IN_PROGRESS
    ↓
Deadline Reached
    ↓
EXPIRED / Auto-finalize
    ↓
Grading
```

Hệ thống không phụ thuộc browser còn mở.

Có thể triển khai bằng:

- Scheduler.
- Lazy expiration.
- Hoặc kết hợp.

Nhưng business result phải nhất quán.

---

# 25. Multiple Attempts

Session có:

```text
maxAttempts >= 1
```

Mọi Attempt đều được giữ lịch sử.

V1 xác định kết quả tổng thể bằng:

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

Future Scope có thể hỗ trợ:

```text
LATEST
FIRST
AVERAGE
```

---

# 26. Automatic Grading

V1 chỉ hỗ trợ loại Question có thể chấm tự động.

---

## 26.1. SINGLE_CHOICE

```text
selected == correct
→ full points

otherwise
→ 0
```

---

## 26.2. TRUE_FALSE

```text
answer == correct
→ full points

otherwise
→ 0
```

---

## 26.3. MULTIPLE_CHOICE

V1 dùng exact-set match.

Ví dụ đáp án:

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

Không partial score trong V1.

---

## 26.4. NUMERIC_ANSWER

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

---

## 26.5. Negative Marking

V1 không có điểm âm.

Sai:

```text
0
```

---

## 26.6. Precision & Rounding

Tính toán sử dụng precision đầy đủ.

Pass/Fail so sánh bằng raw score.

Hiển thị:

```text
2 chữ số thập phân
HALF_UP
```

Không round trước khi xác định Pass/Fail.

---

# 27. Result Visibility

Result được điều khiển bởi hai nhóm policy độc lập.

---

## 27.1. Result Display Mode

```text
HIDDEN
SCORE_ONLY
SUMMARY
DETAILED
```

### HIDDEN

Chưa hiển thị kết quả.

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

Có thể hiển thị thêm:

- Từng Question.
- Answer Participant đã chọn.
- Correct Answer.
- Explanation.

---

## 27.2. Result Release Policy

```text
IMMEDIATE
AFTER_SESSION_END
MANUAL
```

### IMMEDIATE

Xem ngay sau khi Attempt được finalize.

### AFTER_SESSION_END

Chỉ công bố sau khi Session kết thúc.

### MANUAL

Creator chủ động publish Result.

---

## 27.3. Default

```text
resultDisplayMode = SUMMARY
resultReleasePolicy = AFTER_SESSION_END
```

Mục tiêu:

- Tránh Participant thi sớm xem đáp án rồi chia sẻ cho người khác.
- Cho Creator kiểm soát thời điểm công bố.

---

# 28. My Exams / Exam Discovery

Participant có thể xem:

```text
Upcoming
Available
Completed
Expired
```

Nguồn quyền có thể đến từ:

```text
PUBLIC
CLASS
INDIVIDUAL
```

Hệ thống không trả Session Participant không có quyền.

---

# 29. Realtime Monitoring

Creator có thể theo dõi một Session đang diễn ra.

Thông tin tổng quan:

```text
Total Participants
Not Started
In Progress
Submitted
Disconnected
```

Thông tin mỗi Participant:

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

Các browser event chỉ là tín hiệu hỗ trợ.

Không được quảng cáo là cơ chế chống gian lận tuyệt đối.

---

# 30. Reporting & Analytics

Creator có thể xem:

```text
Average Score
Highest Score
Lowest Score
Pass Rate
Completion Rate
Score Distribution
```

Analytics phải dựa trên đúng:

```text
Exam Version
+
Exam Session
```

Không trộn dữ liệu lịch sử với Question Bank hiện tại.

---

# 31. Question Analytics

Mỗi Question Snapshot có thể được phân tích:

```text
Correct Rate
Incorrect Rate
Unanswered Rate
Average Answer Time
```

Có thể phát triển thêm:

```text
Difficulty Index
Discrimination Index
```

Hai chỉ số nâng cao không bắt buộc V1.

---

# 32. Excel Export

Creator có thể export:

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

Định dạng:

```text
.xlsx
```

---

# 33. Notification

## 33.1. V1 Core

In-app notification là bắt buộc.

Trigger chính:

```text
EXAM_ASSIGNED
EXAM_REMINDER
RESULT_RELEASED
CLASS_JOINED
```

Nghiệp vụ:

- Xem danh sách.
- Đọc/chưa đọc.
- Mark as read.
- Mark all as read.

---

## 33.2. Email Notification

Email là:

```text
Optional V1 / V1.1
```

Ưu tiên cho:

```text
EXAM_ASSIGNED
EXAM_REMINDER
RESULT_RELEASED
```

Không gửi email cho các event kỹ thuật:

```text
AUTOSAVE
ATTEMPT_STARTED
WEBSOCKET_CONNECTED
```

---

# 34. Participant Dashboard

Dashboard nên hiển thị:

```text
Upcoming Exams
Available Exams
In-progress Attempt
Recently Completed Exams
Recent Results
Average Score
Notifications
```

---

# 35. Creator Dashboard

Có thể hiển thị:

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

Quick Actions:

```text
Create Question
Import Questions
Create Exam
Create Session
Open Monitoring
```

---

# 36. Admin

Admin V1 tập trung vào User Management.

Có thể:

```text
View Users
Search Users
Filter by Role
Filter by Status
Lock User
Unlock User
Manage PARTICIPANT / CREATOR role
View System Statistics
View Critical Audit Logs
```

Admin không cấp `ADMIN` qua UI thông thường.

---

# 37. Account Lock Rule

Khi Admin khóa User:

```text
status = LOCKED
```

Hệ thống phải:

- Chặn login mới.
- Chặn refresh session mới.
- Revoke refresh session hiện có.
- Giữ toàn bộ dữ liệu lịch sử.

Khi mở khóa:

```text
LOCKED
→ ACTIVE
```

User phải login lại.

---

# 38. Audit Log

Audit các hành động security/business-critical:

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

Audit Record tối thiểu:

```text
actorUserId
action
targetType
targetId
metadata phù hợp
timestamp
```

Không cần audit toàn bộ GET request.

Audit lưu bền vững trong PostgreSQL, cùng transaction với thay đổi nghiệp vụ.
Lỗi audit phải rollback nghiệp vụ; rollback nghiệp vụ không để lại audit thành công.
Timestamp do server tạo. `actorUserId` lấy từ principal đã xác thực, hoặc rỗng
cho System. Metadata chỉ chứa trường an toàn cần cho hành động, không lưu
password, token, secret, request body hay entity đầy đủ. Không xóa audit khi
resource hoặc account thay đổi trạng thái.

---

# 39. Business Rules chính thức

## BR-01 - Multi-role

User có thể đồng thời là `PARTICIPANT` và `CREATOR`.

## BR-02 - Creator self-service

Creator không cần Admin phê duyệt.

## BR-03 - Admin protected

Client không được tự cấp `ADMIN`.

## BR-04 - Backend Authorization

Backend là source of truth về quyền.

## BR-05 - Secure Session Refresh

Refresh session phải hỗ trợ rotation, reuse detection và revoke.

## BR-06 - Preserve History

Các thao tác remove/archive/lock không được xóa dữ liệu thi lịch sử.

## BR-07 - Question Ownership

Question private theo Creator trong V1.

## BR-08 - Question Archive

Question đã sử dụng không hard-delete làm mất lịch sử.

## BR-09 - Immutable Exam Version

Published Exam Version không được chỉnh sửa.

## BR-10 - New Version

Muốn thay đổi đề đã publish phải tạo Draft Version mới.

## BR-11 - Exam Snapshot

Question Bank thay đổi không làm thay đổi đề cũ.

## BR-12 - Score per Question

Total score = tổng points của Question.

## BR-13 - Passing Score per Session

Passing Score thuộc Exam Session.

## BR-14 - One Access Type

Một Session chỉ có một loại:

```text
PUBLIC
CLASS
INDIVIDUAL
```

## BR-15 - Public Requires Login

Public Exam V1 vẫn yêu cầu login với role Participant.

## BR-16 - Session Lifecycle

```text
DRAFT
SCHEDULED
OPEN
CLOSED
CANCELLED
```

## BR-17 - Lock Critical Config

Khi đã có Attempt, không sửa config ảnh hưởng fairness.

## BR-18 - Backend Deadline

Backend lưu `min(startedAt + duration, session.endTime)` khi Start Attempt.
Gia hạn Session không đổi deadline đã lưu hoặc mở lại Attempt hoàn tất.

## BR-19 - Stable Shuffle

Shuffle chỉ xác định một lần mỗi Attempt.

## BR-20 - Autosave

Answer phải được lưu trong khi làm bài.

## BR-21 - Idempotent Submit

Duplicate submit không tạo duplicate Result/Grading.

## BR-22 - Server-side Finalization

Hết giờ phải được xử lý phía server.

## BR-23 - Best Score

Multiple Attempt V1 dùng `BEST_SCORE`.

## BR-24 - Exact Multiple Choice

MULTIPLE_CHOICE dùng exact-set match.

## BR-25 - Numeric Tolerance

NUMERIC_ANSWER hỗ trợ absolute tolerance.

## BR-26 - No Negative Marking

V1 không có điểm âm.

## BR-27 - Result Policy

Result phụ thuộc Display Mode và Release Policy.

## BR-28 - Default Result Policy

```text
SUMMARY + AFTER_SESSION_END
```

## BR-29 - Correct Answer Protection

Correct Answer/Explanation không gửi trong Active Attempt.

## BR-30 - Excel Preview

Import phải Preview + Validate trước khi commit.

## BR-31 - Critical Audit

Các hành động security/business quan trọng phải audit.

---

# 40. Kịch bản demo chính

```text
Creator Register / Login
        ↓
Create Classroom
        ↓
Generate Join Code
        ↓
Participant Join Classroom
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

Đây là flow demo tiêu chuẩn của Learnova V1.

---

# 41. Scope V1

## 41.1. Bắt buộc

```text
Authentication
Google Login
Multi-role
Classroom
Question Bank
Excel Import
Exam Versioning
Exam Session
PUBLIC / CLASS / INDIVIDUAL Assignment
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

---

## 41.2. Optional V1 / V1.1

```text
Email Notification
Difficulty Index
Discrimination Index
Advanced Browser Monitoring
```

---

## 41.3. Future Scope

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

# 42. Giá trị kỹ thuật của đề tài

Learnova cho phép thể hiện các vấn đề kỹ thuật thực tế:

```text
REST API
Spring Security
Multi-role Authorization
JWT Authentication
Secure Refresh Session
Redis
JPA / Hibernate
PostgreSQL
Flyway
Transaction
Concurrency
Idempotency
Autosave
Server-side Deadline
WebSocket
Realtime Monitoring
Excel Processing
Analytics
Next.js
API Contract
Testing
Audit
```

Công nghệ phải phục vụ business use case.

Không thêm công nghệ chỉ để làm portfolio.

---

# 43. Nguyên tắc phát triển

Ưu tiên:

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
Readability
        ↓
Maintainability
        ↓
Performance
```

Khi requirement thay đổi và ảnh hưởng tới:

```text
Database
API
Security
Business Rule
Data Consistency
UI Flow
```

phải cập nhật tài liệu liên quan.

---

# 44. Quan hệ với các tài liệu khác

```text
business-requirements.md
→ WHAT + WHY

use-cases.md
→ Actor + User/System Flow + Exception

screen-flow.md
→ Màn hình và điều hướng

ERD / Data Model
→ Cấu trúc dữ liệu

OpenAPI
→ API Contract

Architecture / Security docs
→ Cách triển khai kỹ thuật
```

Không đặt toàn bộ chi tiết implementation vào Business Requirements.

---

# 45. Tóm tắt

Learnova V1 tập trung vào một business core:

> **Tạo câu hỏi - Tạo và version hóa đề - Tổ chức kỳ thi - Làm bài an toàn - Chấm điểm - Giám sát realtime - Công bố kết quả - Phân tích dữ liệu.**

Mục tiêu không phải có nhiều feature nhất.

Mục tiêu là xây một Online Assessment Platform có:

- Nghiệp vụ rõ.
- Data integrity tốt.
- Security hợp lý.
- Flow dễ demo.
- Đủ chiều sâu kỹ thuật.
- Có khả năng mở rộng về sau.

> [!NOTE]
> Trong quá trình code, nếu phát hiện nghiệp vụ cần điều chỉnh để phù hợp thực tế hơn, phải cập nhật lại tài liệu nghiệp vụ và Use Case tương ứng để tài liệu luôn phản ánh hệ thống hiện tại.
