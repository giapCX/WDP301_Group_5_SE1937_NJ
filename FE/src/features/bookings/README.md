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

Màn operator dùng chung API client tại `src/api/client.js`. Mặc định `/api` được Vite proxy tới backend cổng 5000. Chạy `npm run dev:operator` từ thư mục gốc để khởi động backend với database `tourist_car_rental_demo` và giao diện Vite.

Bộ lọc trạng thái và phân trang thực hiện trên server. Tìm mã/tên/số điện thoại và lọc số chỗ chỉ áp dụng trên trang hiện tại, đã ghi rõ trên giao diện. Thống kê là tổng theo trạng thái, không phải thống kê theo ngày vì API chưa có bộ lọc ngày.

Auth chưa được bật trong giai đoạn operator này. API dùng operator mẫu có `user_id=3` để ghi nhận người xử lý; khi tích hợp auth, thay giá trị này bằng người dùng đã xác thực. Lỗi 409 yêu cầu tải lại xe trước khi duyệt lại.

Không hiển thị loại dịch vụ, tên tài xế hay đánh giá giả vì backend chưa cung cấp. Chỉ gợi ý xe, chưa phân công tài xế. Nút làm mới thay cho nút tạo lệnh trong ảnh do chức năng tạo lệnh chưa có API.

## Kiểm tra

Chạy `npm run build` từ FE. Kiểm tra thủ công tab trạng thái, tìm kiếm, phân trang, mở chi tiết, danh sách xe, điều kiện bật nút duyệt/từ chối và màn hình nhỏ.
