# Manager dashboard

Dashboard vận hành cho Manager. Page, components, hook, API client, formatters và styles được tách theo feature; mọi chỉ số, trạng thái đội xe, doanh thu, booking và cảnh báo đều lấy từ `GET /api/manager/dashboard`.

Backend yêu cầu session đăng nhập có vai trò `manager`. Endpoint tổng hợp dữ liệu từ `vehicles`, `bookings`, `payments`, `driver_profiles`, `trip_assignments`, `maintenance_records`, `incidents` và `users`. Các trường không có trong schema hiện tại, chẳng hạn đồng hồ kilomet, không được tự tạo trên giao diện.
