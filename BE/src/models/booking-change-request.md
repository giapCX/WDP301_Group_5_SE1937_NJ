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

Chưa có API hay màn Booking Modification. Khi làm Service phải xác minh quyền, người yêu cầu sở hữu booking, ngày giờ, thứ tự điểm dừng, chênh lệch giá và trường xét duyệt theo trạng thái. Trước khi áp dụng phải đối chiếu snapshot before với booking hiện tại để tránh áp dụng yêu cầu cũ, rồi kiểm tra lịch và cập nhật trong transaction có khóa lịch xe. Không sửa booking khi yêu cầu chỉ mới pending.
