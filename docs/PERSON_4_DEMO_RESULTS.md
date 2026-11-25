# Kết quả demo người 4 – 25/11/2026

## Cách chạy

Chạy chính frontend/backend hiện tại trên môi trường riêng: frontend http://127.0.0.1:3101, backend 5101. Database riêng có tiền tố `person4_demo_`; không sửa các đơn tại localhost:3000. Tài khoản và thông tin định danh đều DEMO, không thanh toán hoặc hoàn tiền thật.

Kịch bản gọi HTTP API qua đăng nhập/session thật, không dùng mock actor. Đối chiếu trạng thái và số tiền trực tiếp trong database. Trên trình duyệt đã đăng nhập Renter/Manager, nhập thông tin giả, mở hợp đồng A4, tích ký bản mô phỏng, đặt cọc mô phỏng, gửi hủy ngoại lệ và đọc hàng đợi hoàn tiền của Manager. Các quyết định Operator/Manager còn lại được chạy qua API thật; không khẳng định mọi nút giao diện đã được nghiệm thu.

## Kết quả

| Đơn demo | Kịch bản | Kết quả cuối |
|---|---|---|
| #1 | Đặt xe, báo giá 2.000.000; ký; thanh toán thất bại rồi thành công; đổi điểm đón và chấp nhận giá 2.500.000; phụ phí chờ 200.000 bị tranh chấp rồi miễn | confirmed, hợp đồng active, đã thu 600.000, phụ phí 0; lịch mới và lịch sử đã lưu |
| #1 | Operator phân công, Driver nhận; Operator đọc Trip Monitoring | Phân công accepted, Driver 1, hiển thị chuyến khi lọc tất cả trạng thái |
| #2 | Đặt cọc 600.000; hủy theo phí 10% của 2.000.000; Operator duyệt; Manager duyệt/hoàn mô phỏng | cancelled, hợp đồng cancelled, phí giữ 200.000, hoàn 400.000 |
| #3 | Renter khiếu nại; Operator đề xuất hỗ trợ 100.000; Manager duyệt; Operator đóng; Manager duyệt/hoàn | Sự cố resolved, hoàn bồi thường 100.000, không biến khoản bồi thường thành nợ thu lại |
| #4 | Ký và đặt cọc 10.000 trên trình duyệt; gửi yêu cầu hủy; phí ban đầu 200.000; Operator bị chặn vượt quyền; Manager giữ lại 5.000 | cancelled, hợp đồng cancelled, hoàn mô phỏng 5.000 |
| #5 | Driver 1 đang nhận đơn trùng lịch, Driver 2 nghỉ; vẫn còn xe | Sau sửa, gửi báo giá bị chặn HTTP 409 với lý do không còn tài xế đủ điều kiện |

Các kiểm tra âm đã chạy: chưa ký không mở thanh toán; thanh toán thất bại không kích hoạt; lặp callback thanh toán/hoàn tiền bị chặn; chưa chấp nhận giá mới không duyệt đổi lịch; Renter khác không truy cập được đơn; sai role không truy cập được API; sự cố đặc biệt chưa duyệt không đóng được.

## Lỗi tìm thấy và sửa

1. `booking-readiness.repository.js` dùng nhầm `estimated_end_at` thay vì `estimated_end_time`, khiến bỏ sót tài xế đang có chuyến trùng giờ. Đã tái hiện lỗi bằng HTTP (trước sửa trả 200, sau sửa trả 409). Bổ sung regression trong operations integration test, gồm cả ranh giới hai chuyến tiếp giáp không trùng nhau.
2. `SignedContractView` và `RenterOperations` có cùng React key là booking_id, gây cảnh báo trùng key và lặp thẻ hợp đồng khi cập nhật thanh toán/yêu cầu. Đã đổi key của hợp đồng sang `contract:<booking_id>`.

## Kiểm tra sau sửa

- Backend: 42/42 test đạt với MongoDB replica set test, không skip.
- Frontend: build thành công; còn cảnh báo kích thước bundle của Vite.
- Backend đang dùng tại localhost:3000 vẫn phản hồi API thành công.
- Hai bản sửa chưa commit/push tại thời điểm ghi báo cáo.

## Phạm vi chưa kiểm tra trong lần demo này

Không thay đổi đồng hồ hệ thống để giả lập toàn bộ chuyến chạy ngoài thực tế. Trip Monitoring được đối chiếu ở bước phân công/Driver nhận chuyến; toàn bộ vòng đời nhận xe Gara, chạy xe và trả xe thuộc phần người 2/3 không được thao tác xuyên suốt trong lần demo người 4 này. GPS, email/SMS và thanh toán thật không nằm trong phạm vi.

Các script chuẩn bị/chạy demo và kết quả JSON nằm trong FE/local-demo/workflow4-demo (đã bị Git ignore cùng helper đăng nhập demo).
