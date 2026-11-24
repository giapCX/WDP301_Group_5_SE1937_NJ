# Driver dashboard

Route `/driver/dashboard`, được bảo vệ bởi RequireRole(driver). Sau login role driver tự chuyển đến trang này qua dashboardRoutes.js. Dùng chung CSS nền, icon, badge trạng thái, định dạng ngày/mã booking và layout sidebar tương tự Operator; không tạo dữ liệu demo giả trên giao diện.

## Cấu trúc frontend

- api/driverApi.js: hai API đọc dữ liệu Driver.
- hooks/useDriverDashboard.js: loading/error, refresh, lọc và phân trang 10 chuyến.
- components/DriverSidebar.jsx: điều hướng nội bộ và đăng xuất bằng session API.
- components/DriverStats.jsx: tổng, sắp khởi hành, đang chạy, hoàn thành.
- components/DriverTripTable.jsx: bảng xe, khách, địa điểm, thời gian và trạng thái.
- components/DriverTripDetail.jsx: khung hành trình, điểm dừng và 20 cập nhật trạng thái gần nhất; hỗ trợ Escape và giữ focus trong dialog.
- pages/DriverDashboardPage.jsx: ghép dashboard, chuyến ưu tiên, hồ sơ và giấy phép.
- styles/driver.css: phần CSS riêng của Driver, có breakpoint cho màn hình nhỏ.

## Backend

GET /api/driver/dashboard?status=all&page=1&limit=10
GET /api/driver/trips/:id (id là booking_id)

API sử dụng attachUser session đang có và requireDriver, không nhận driver_id từ query. driver_profiles.user_id xác định tài xế; chỉ đọc trip_assignments của tài xế đó. Bản phân công mới nhất của cùng booking được dùng, bỏ phân công rejected/cancelled. Khi chưa có profile trả 404. Khi mở chuyến không được giao trả 404. Không trả mật khẩu, email hay giá/thu nhập giả.

Các bộ lọc: all, upcoming (confirmed và chưa đến giờ đón), active (in_progress), completed. Chuyến ưu tiên là chuyến đang chạy trước, sau đó tới chuyến sắp khởi hành gần nhất. Tổng thống kê không thay đổi theo trang hoặc bộ lọc. Phiên bản hiện tại tải các phân công của Driver rồi phân trang kết quả ở Service; có thể chuyển sang aggregation khi dữ liệu lớn.

Dashboard chỉ xem dữ liệu đã có. Chưa thêm API nhận/từ chối phân công, đổi lịch sẵn sàng, báo cáo sự cố, cập nhật tiến độ hoặc báo cáo cuối chuyến. Không hiển thị nút cho chức năng chưa có.

## Kiểm tra

Frontend: npm run build từ FE.
Backend: node --test tests/driver-dashboard.test.js từ BE; dùng TEST_MONGO_URI nếu cần đổi replica set test. Test kiểm tra đăng nhập session, role, chuyến của hai Driver, không truy cập chéo, phân trang, trạng thái và thu hồi phân công. Database test riêng được xóa sau kiểm tra.

Tài khoản mẫu: demo5@example.com (Driver An), demo6@example.com (Driver Binh), mật khẩu Demo@12345. Cần đã seed dữ liệu. Đăng nhập tại /login rồi tự chuyển đến dashboard Driver.
