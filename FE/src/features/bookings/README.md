# Giao diện quản lý booking

Màn chính: `/operator/bookings`. Đường dẫn `/` chuyển đến màn này. Giao diện store cũ vẫn ở `/store` và `/cart`.

## Cấu trúc

- `api/bookingApi.js`: các request booking và thông báo lỗi API.
- `hooks/useBookings.js`: tải danh sách, tổng theo trạng thái, phân trang và refresh.
- `hooks/useBookingReview.js`: tải chi tiết, xe phù hợp, gửi duyệt/từ chối.
- `components/BookingSidebar.jsx`: sidebar và các liên kết trong màn.
- `components/BookingStats.jsx`: các thẻ thống kê từ API.
- `components/BookingTable.jsx`: bảng cùng trạng thái loading, lỗi và rỗng.
- `components/BookingReview.jsx`: khung chi tiết, hành trình, chọn xe và lý do từ chối.
- `components/AvailableVehicleCards.jsx`: xe phù hợp cho booking chờ duyệt gần nhất; ảnh xe là SVG minh họa, không phải ảnh thực của xe.
- `components/BookingStatus.jsx`, `BookingIcon.jsx`: trạng thái và icon dùng chung trong feature.
- `bookingConstants.js`: nhãn trạng thái, định dạng mã booking, tiền và thời gian.
- `pages/BookingManagementPage.jsx`: ghép các phần và điều khiển bộ lọc/khung chi tiết.
- `styles/bookings.css`: CSS được giới hạn trong `.dispatch-app`, hỗ trợ desktop và mobile.

## Kết nối

`VITE_API_BASE_URL` trong `FE/.env` phải trỏ đúng API đang chạy. Mặc định của client là `http://localhost:9999/api`; nếu backend dùng port 5000, đặt `VITE_API_BASE_URL=http://localhost:5000/api` rồi khởi động lại Vite. Không có dữ liệu giả thay thế khi API lỗi.

Bộ lọc trạng thái và phân trang thực hiện trên server. Tìm mã/tên/số điện thoại và lọc số chỗ chỉ áp dụng trên trang hiện tại, đã ghi rõ trên giao diện. Thống kê là tổng theo trạng thái, không phải thống kê theo ngày vì API chưa có bộ lọc ngày.

Không tự gán Operator hay giả lập đăng nhập. PATCH duyệt/từ chối trả thông báo đăng nhập nếu API phản hồi 401; cần nối module auth trước khi dùng thực tế. Lỗi 409 yêu cầu tải lại xe trước khi duyệt lại. API GET hiện chưa bảo vệ bằng auth.

Không hiển thị loại dịch vụ, tên tài xế hay đánh giá giả vì backend chưa cung cấp. Chỉ gợi ý xe, chưa phân công tài xế. Nút làm mới thay cho nút tạo lệnh trong ảnh do chức năng tạo lệnh chưa có API.

## Kiểm tra

Chạy `npm run build` từ FE. Kiểm tra thủ công tab trạng thái, tìm kiếm, phân trang, mở chi tiết, danh sách xe, điều kiện bật nút duyệt/từ chối và màn hình nhỏ.

## Số chỗ khách yêu cầu

Booking.requested_seat_count lưu số chỗ Renter chọn, độc lập với vehicle_id. Người phụ trách tạo booking phải lưu field này từ lựa chọn khách (số nguyên dương), không suy ra từ xe Operator gán. Ví dụ requested_seat_count=7 chỉ trả xe seat_count=7, không tự nâng lên 16 chỗ. Duyệt cũng kiểm tra lại trong transaction, trả 409 nếu cố chọn khác số chỗ.

Booking cũ thiếu số chỗ bị chặn điều phối bằng lỗi 409; không hiển thị mọi xe làm phương án mặc định. Chạy node scripts/add-requested-seat-count.js từ BE để thêm field null còn thiếu; không đoán yêu cầu khách. Sau đó bổ sung thông tin thực tế khi xác nhận với Renter. Dữ liệu seed mới có số chỗ giả lập rõ ràng cho từng booking; booking mẫu #1 yêu cầu 7 chỗ. JSON bookings đã cập nhật tương ứng.
