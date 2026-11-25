# Trip Monitoring

Route: /operator/trip-monitoring. Sidebar Operator có mục Theo dõi chuyến.

## Tái sử dụng

Dùng lại BookingSidebar, BookingIcon, BookingStatus, định dạng ngày/mã và CSS nền Operator. Khung chi tiết tái sử dụng DriverTripDetail, bổ sung props loadTrip/eyebrow để gọi API Operator mà không đổi API Driver. Khi dữ liệu có driver, khung chi tiết hiển thị tài xế phụ trách.

## Chia file

- api/tripMonitoringApi.js: request danh sách và chi tiết.
- hooks/useTripMonitoring.js: trạng thái, phân trang 10 chuyến, refresh và thời điểm tải gần nhất.
- components/MonitoringTable.jsx: xe/tài xế, khách, lộ trình và cập nhật gần nhất.
- pages/TripMonitoringPage.jsx: ghép thống kê, bộ lọc, bảng, phân trang và khung chi tiết.
- styles/tripMonitoring.css: CSS riêng cho thống kê và màn theo dõi.

## API

GET /api/operator/trips?status=in_progress&page=1&limit=10
GET /api/operator/trips/:id (booking_id)

RequireOperator bảo vệ cả hai endpoint; session được đọc bởi attachUser đang có. Status gồm all, confirmed, in_progress, completed. all bao gồm ba trạng thái chuyến trên, không gồm pending/rejected/cancelled. Phân trang tối đa 10. Thống kê tính trên toàn bộ chuyến, không chỉ trang hiện tại.

Danh sách kết hợp bookings, xe/khách, phân công mới nhất (bỏ cancelled/rejected) và trip_status_updates mới nhất. Không giả lập tài xế/trạng thái. Chi tiết gồm các điểm dừng theo stop_order và tối đa 20 cập nhật gần nhất. Không trả password_hash, email, giấy phép hoặc chi tiết phụ phí. Trạng thái booking và cập nhật hành trình hiển thị riêng vì dữ liệu có thể chưa đồng bộ; nguồn cập nhật có thể là Driver hoặc nhân viên. Màn này chưa có định vị GPS, bản đồ, realtime/push hoặc API để Driver cập nhật trạng thái.

Dùng Làm mới dữ liệu để tải lại danh sách. Đóng/mở lại khung chi tiết hoặc Thử lại khi lỗi sẽ lấy lại chi tiết. Không tự thay đổi booking hay cập nhật tiến độ khi xem.

## Kiểm tra

npm run build từ FE.
node --test tests/trip-monitoring.test.js từ BE (TEST_MONGO_URI chọn replica set test).
Đã kiểm tra bảo vệ role, dữ liệu xe/tài xế thật, bản cập nhật mới nhất, phân trang, mảng rỗng, trạng thái chưa phân công và lỗi 400/404.
