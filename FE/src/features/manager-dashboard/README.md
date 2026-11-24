# Manager dashboard

Dashboard và các workspace cho Manager. Page, components, hook, API client, formatters và styles được tách theo feature. Chỉ số, trạng thái đội xe, doanh thu, booking, hiệu suất tài xế và cảnh báo lấy từ `GET /api/manager/dashboard`. Hồ sơ xe/tài xế, phê duyệt, bảng giá, chính sách, khuyến mãi và nhật ký là nghiệp vụ Manager; API kiểm tra role/permission phía server.

Backend yêu cầu session đăng nhập có vai trò `manager`. Endpoint tổng hợp dữ liệu từ `vehicles`, `bookings`, `payments`, `driver_profiles`, `trip_assignments`, `maintenance_records`, `incidents` và `users`. Các trường không có trong schema hiện tại, chẳng hạn đồng hồ kilomet, không được tự tạo trên giao diện.
