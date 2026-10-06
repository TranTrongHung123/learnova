# F16 — Realtime monitoring

## Nghiệp vụ và dữ liệu

UC-MON-01, phụ thuộc F13–F15. Chỉ CREATOR ACTIVE sở hữu Session được xem snapshot
và subscribe; ADMIN không tự có quyền CREATOR. Monitoring không trả answers, correct
answers, explanation hoặc score. Result policy và grading không thay đổi.

Projection trong module `monitoring` hợp nhất assignment hiện tại và người đã có
Attempt; CLASS chỉ lấy membership ACTIVE, union khử trùng giữa các lớp. Mỗi người
hiển thị **lượt mới nhất**, khác BEST_SCORE của Results. Xóa assignment/membership
không xóa người đã có lịch sử. PUBLIC chỉ đếm người đã bắt đầu, không có mẫu số
assignment và không trả `notStarted` (UI hiển thị “Không áp dụng”).

`answeredCount` đếm JSON answer đã persist: optionIds không rỗng, booleanValue khác
null (gồm false), hoặc numericValue khác null (gồm 0). Mark-for-review không tính là
trả lời. `totalQuestions` dùng published version. `submitted` tổng hợp các lượt mới
nhất SUBMITTED/EXPIRED/GRADED; UI gọi “Đã hoàn tất”, từng dòng giữ đúng business state.

Migration V14 thêm `attempts.last_seen_at timestamptz`, nullable để lịch sử cũ không
bị gán timestamp giả. Start và autosave thành công cập nhật timestamp trong cùng
transaction. `POST /api/v1/attempts/{id}/heartbeat` chỉ nhận bearer, kiểm tra role,
ownership và khóa Attempt; ghi giờ server nếu còn IN_PROGRESS trước deadline.
Heartbeat trễ/no-op không đổi trạng thái bài làm. Client gửi mỗi 15 giây, hủy khi
rời trang hoặc hoàn tất. Nhiều tab cùng tồn tại dùng timestamp mới nhất.

CONNECTED khi lastSeen cách giờ server dưới 45 giây; thiếu heartbeat hoặc quá ngưỡng
là DISCONNECTED, chỉ áp dụng cho IN_PROGRESS. Unstarted/completed dùng
NOT_APPLICABLE. Đây là tín hiệu liên lạc với ứng dụng, không chứng minh tập trung
làm bài hay gian lận; browser có thể throttle tab nền. LastSeen còn được giữ sau
khi hoàn tất. Server finalizer F14 vẫn là nơi quyết định kết thúc bài.

## Luồng và consistency

```mermaid
sequenceDiagram
    participant P as Participant browser
    participant A as Attempt service
    participant DB as PostgreSQL
    participant C as Creator browser
    participant M as Monitoring REST / WebSocket
    P->>A: Start / autosave / heartbeat / submit
    A->>DB: Transaction + Attempt lock
    DB-->>A: Commit
    C->>M: GET Session monitor (bearer)
    M->>DB: Owner check + repeatable-read projection
    M-->>C: REST snapshot
    C->>M: WebSocket SUBSCRIBE (access JWT, Session ID)
    M->>DB: Verify active CREATOR + ownership; fresh projection
    M-->>C: SYNC, streamId, sequence 1
    loop Every 2 seconds while subscribed
        M->>DB: Recheck permission + committed projection
        M-->>C: DELTA: changed rows, removals, summary, sequence
    end
    Note over C,M: Disconnect / sequence gap → REST refetch → new subscribe + SYNC
```

V1 dùng Spring native WebSocket và browser WebSocket, không STOMP/SockJS/message
broker. Server đọc projection định kỳ **chỉ khi có subscription**, mỗi connection
một query cycle, rồi diff với view trước đó. Transaction read-only REPEATABLE_READ
kết thúc trước khi gửi frame: không có dữ liệu chưa commit và không giữ DB transaction
qua kết nối. Không cần hook vào transaction grading hoặc cơ chế event delivery bền vững.

Đây là realtime view với độ trễ mục tiêu khoảng 2 giây cộng thời gian query/network,
không phải nhật ký đầy đủ mọi chuyển trạng thái: nhiều commit trong một chu kỳ có
thể gộp lại. Các nhãn STARTED/SUBMITTED/CONNECTED/DISCONNECTED/PROGRESS mô tả thay đổi
đã quan sát. Đối soát bắt cả roster edits, hết TTL, service restart và commit từ
instance khác dùng chung PostgreSQL, không phụ thuộc event bus trong memory.

SYNC đầu tiên sau authorization chứa toàn bộ rows, thay thế REST snapshot để khép
khoảng trống snapshot → subscribe. DELTA mang streamId riêng mỗi connection và
sequence tăng liên tục, kể cả khi không có thay đổi (keepalive). Client bỏ duplicate/
sequence cũ; gap hoặc sai stream làm reconnect. Callback socket cũ bị vô hiệu khi
unmount/retry/đổi session. Không giữ event để replay qua reconnect.

Client giữ dữ liệu đã nhận kèm cảnh báo stale, reconnect backoff 1–15 giây, watchdog
12 giây không có frame. Mỗi reconnect lại fetch REST, subscribe và thay bằng SYNC;
403/404/4403 xóa dữ liệu và hiển thị trạng thái không có quyền/không tìm thấy.
Nút “Đồng bộ lại” khởi động lại toàn bộ flow.

## Xác thực và vận hành

- Endpoint `/api/v1/monitoring/ws` cho phép upgrade nhưng chưa cho quyền đọc dữ liệu.
  Frame đầu phải SUBSCRIBE trong 10 giây, tối đa 8 KiB, gồm access JWT và sessionId.
  Một socket chỉ có một subscription; gửi lại bị đóng.
- JWT được kiểm tra bằng decoder hiện có; không dùng refresh cookie hoặc credential
  trong URL. Origin allowlist dùng `learnova.auth.allowed-origins`. Không log frame/token.
- Subscription kiểm tra user/role/ownership ngay từ đầu và mỗi query cycle. Hết hạn
  JWT đóng 4401; denied 4403; lỗi service/transport 1011. Frontend dùng shared refresh
  của AuthSession trước khi mở lại nếu access token sắp hết hạn.
- `ConcurrentWebSocketSessionDecorator` giới hạn send buffer 1 MiB/send time 5 giây;
  serialization giữa SYNC và tick giữ đúng thứ tự. Xem [Spring WebSocket API](https://docs.spring.io/spring-framework/reference/web/websocket/server.html).
- Production proxy phải forward Upgrade/Connection, dùng WSS và timeout lớn hơn
  chu kỳ keepalive. Không bật body/frame logging có token. Chưa kiểm chứng proxy/TLS thật.
- Cấu hình `learnova.monitoring.update-delay-ms` mặc định 2000; nếu tăng phải điều chỉnh
  watchdog frontend tương ứng. Đối soát hiện tại tỷ lệ theo số connection × roster;
  chưa load test quy mô lớn. UI phân trang 25 rows, snapshot vẫn gồm toàn roster.
  Khi có tải thực cần đo rồi cân nhắc shared projection/subscription fan-out;
  không thêm Redis pub/sub hoặc broker vào F16.
- Monitoring có scheduler riêng để query/send chậm không trì hoãn business scheduler
  xử lý deadline. Monitoring outage không sửa
  dữ liệu Attempt/Result; không dùng trạng thái WS để điều khiển autosave/submit.

## Giao diện và kiểm chứng

Sidebar Giám sát → `/creator/monitor` mặc định lọc OPEN; mở từ Session detail hoặc
Session card → `/creator/sessions/[sessionId]/monitor`. Trang vẫn đọc được khi Session
chưa mở/đã kết thúc và nói rõ trạng thái. Summary, participant search, pagination,
answered progress, lastSeen và kết nối có nhãn chữ; responsive rows trên mobile.

Thiết kế theo [Master](../../design-system/learnova/MASTER.md) và
[override Monitoring](../../design-system/learnova/pages/monitoring.md).
API/schema/protocol: [OpenAPI](../api/openapi.yaml).

Kiểm thử bao gồm API ownership/role, PUBLIC, CLASS/history, latest attempt, false answer,
clear answer, heartbeat TTL/no finalization, committed projection/rollback, WebSocket
origin/subscription/auth timeout/token expiry, SYNC gap reconciliation và payload privacy.
Frontend reducer kiểm tra duplicate/out-of-order/gap/removal/reconnect. Browser dùng
backend/PostgreSQL/Redis thật: `npm run test:monitoring`.
