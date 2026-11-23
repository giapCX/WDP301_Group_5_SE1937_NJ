# Booking change requests

Collection: `booking_change_requests`. Model: `BookingChangeRequest`, import từ `src/models`.

| Field | Ý nghĩa |
| --- | --- |
| change_request_id | ID số duy nhất, cùng quy ước ID của dự án; chưa tự tăng |
| booking_id | Liên kết bookings.booking_id |
| requested_by / requested_at | User yêu cầu và thời điểm gửi |
| reason | Lý do thay đổi |
| before / after | Snapshot đầy đủ điểm đón/trả, thời gian, giá dự kiến và danh sách điểm dừng |
| price_difference | Giá after trừ giá before; có thể âm. Là chênh lệch đề xuất, chưa phải khoản đã thu/hoàn |
| request_status | pending, approved, rejected, cancelled |
| reviewed_by / reviewed_at | Operator xử lý và thời điểm; null khi chưa xử lý |
| rejection_reason | Lý do từ chối; null với trạng thái khác |

Virtual populate: `booking`, `requester`, `reviewer`. ID liên kết là Number, không phải MongoDB _id. Unique index trên change_request_id; index để lọc theo trạng thái và xem lịch sử theo booking.

Dữ liệu mẫu: 3 yêu cầu của Renter user_id=8 cho booking_id=2. Yêu cầu #1 bị từ chối, #2 được duyệt (after khớp booking mẫu hiện tại), #3 đang chờ duyệt (before khớp booking mẫu hiện tại). Đây là lịch sử giả lập, không phải kết quả chạy API duyệt thay đổi. Seed không áp dụng after vào booking hay tạo khoản phụ phí.

Chạy `npm run seed` từ BE để tạo collection, index và nạp các ID chưa tồn tại. Không ghi đè lịch sử hiện hữu.

Chưa có màn Booking Modification. Service phải xác minh quyền, người yêu cầu sở hữu booking, ngày giờ, thứ tự điểm dừng, chênh lệch giá và trường xét duyệt theo trạng thái. Trước khi áp dụng phải đối chiếu snapshot before với booking hiện tại để tránh áp dụng yêu cầu cũ, rồi kiểm tra lịch và cập nhật trong transaction có khóa lịch xe. Không sửa booking khi yêu cầu chỉ mới pending.

## API xử lý yêu cầu

- PATCH /api/operator/booking-change-requests/:id/approve: không nhận lịch hay người duyệt từ body, áp dụng snapshot after đã lưu.
- PATCH /api/operator/booking-change-requests/:id/reject: body { "rejection_reason": "Lý do từ chối" }.

Cả hai yêu cầu req.user từ xác thực Operator đang hoạt động; hiện module auth chưa tích hợp nên gọi trực tiếp chưa đăng nhập trả 401. Thành công trả { success: true, data: request }. Lỗi: 400 dữ liệu sai, 404 không tồn tại, 409 đã xử lý/lịch trùng/snapshot cũ.

Duyệt chỉ áp dụng booking confirmed, chưa đến giờ đón; người yêu cầu phải là Renter của booking. Service kiểm tra snapshot, thứ tự điểm dừng, chênh lệch giá, tình trạng/lịch xe và lịch tài xế đã phân công. Transaction tăng schedule_version trên xe, cập nhật booking và các trip_stops, rồi đánh dấu yêu cầu approved. Điểm dừng giữ ID theo stop_order; điểm mới dùng ID số ngẫu nhiên an toàn, có unique index. Không thay đổi thanh toán, hoàn tiền hay tự tạo additional_charges; price_difference vẫn là chênh lệch đề xuất. Kiểm tra lịch tài xế chưa thay thế cơ chế khóa khi các module khác phân công tài xế đồng thời; module phân công sau này phải phối hợp transaction/khóa tài xế.

Test tích hợp: node --test tests/booking-change-request.decision.test.js (replica set local 27018).

## Renter tạo yêu cầu

POST /api/renter/bookings/:id/change-requests

```json
{
  "reason": "Muốn đón muộn hơn hai giờ",
  "after": {
    "pickup_time": "2026-12-03T03:00:00Z",
    "estimated_end_time": "2026-12-05T03:00:00Z"
  }
}
```

Trả 201 và { success: true, data: request }. Body after chỉ cho phép pickup_location, dropoff_location, pickup_time, estimated_end_time, trip_stops. Field bỏ qua giữ giá trị cũ; trip_stops nếu có sẽ thay toàn bộ danh sách (mảng rỗng để bỏ tất cả điểm dừng). Điểm dừng gồm stop_order, location, note. Dùng datetime ISO có timezone để tránh hiểu sai giờ.

req.user phải do module xác thực cung cấp, có user_id, role_name=renter, status=active. Backend tự lấy requested_by và snapshot before, không tin requested_by/before/status từ body. Chỉ chủ booking confirmed, chưa khởi hành được gửi; từ chối lịch không đổi và thời gian sai. Transaction dùng khóa lịch xe để tránh hai request pending đồng thời cho cùng booking. Booking/trip_stops giữ nguyên.

Giá đề xuất tạm tính: giá cũ + (số ngày mới - số ngày cũ) * vehicles.price_per_day, ngày tính bằng ceil(thời lượng / 24 giờ). Giữ giá cũ cho thời lượng ngày không đổi. Chưa định giá theo km, điểm dừng, phí chờ, chưa tính lại khuyến mãi và chưa thu/hoàn tiền. Cần thống nhất với module Pricing khi có pricing_rules. Không nhận estimated_price từ frontend. ID yêu cầu mới là số nguyên an toàn ngẫu nhiên với unique index.

Lỗi 400 dữ liệu sai; 401 chưa đăng nhập; 403 sai quyền/chủ booking; 404 không có booking; 409 booking không đủ điều kiện hoặc đã có yêu cầu chờ. API này chưa có form phía Renter.

## Renter xem lịch sử yêu cầu

GET /api/renter/bookings/:id/change-requests?page=1&limit=10&status=pending

Cần req.user Renter active từ xác thực. Chỉ chủ booking được truy cập; requested_by và booking_id gửi trong query không thể đổi phạm vi dữ liệu. Trả các yêu cầu do Renter đó gửi cho booking, mới nhất trước (requested_at, change_request_id giảm dần). Không yêu cầu booking vẫn confirmed nên có thể xem lịch sử chuyến đã hoàn thành/hủy.

Response 200: { success: true, data: { items, total, page, limit, total_pages } }. Mặc định và tối đa 10 bản ghi/trang. status tùy chọn: pending, approved, rejected, cancelled. Mỗi item gồm snapshot before/after, reason, price_difference, trạng thái, thời điểm gửi/xử lý và rejection_reason. Không trả hồ sơ người xử lý, email, password_hash hoặc MongoDB _id. Không có yêu cầu thì items=[], total=0.

Lỗi 400 tham số sai, 401 chưa đăng nhập, 403 sai role/chủ booking, 404 booking không tồn tại. Chưa có form Renter trong thay đổi này.
