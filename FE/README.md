# XeDi Frontend

React JavaScript, Create React App và Tailwind cho trang đăng nhập.

## Chạy từ thư mục FE

```powershell
npm ci
npm start
npm test -- --watchAll=false --runInBand
npm run build
```

Ứng dụng chạy tại `http://localhost:3000`. Proxy `/api` tới backend `http://127.0.0.1:5000`; cần chạy backend và MongoDB để sử dụng dữ liệu thực.

## Tìm code

- `src/app/`: gốc ứng dụng, router và test luồng giao diện.
- `src/features/auth/`: trang đăng nhập, API, hook và lưu phiên.
- `src/features/home/`: trang chủ, metadata và công cụ tính thu nhập.
- `src/features/listings/`: API danh sách xe, hook tìm/lọc xe và VehicleCard.
- `src/components/`: thành phần giao diện dùng chung.
- `src/services/httpClient.js`: HTTP transport dùng chung.

Điểm khởi động vẫn là `src/index.js`. Tailwind scan `src/features/auth/` và giới hạn utility trong `.login-page`. Khi di chuyển giao diện auth, cập nhật cả cấu hình scan.

Xem [hướng dẫn kiến trúc và quy trình làm việc nhóm](../docs/ARCHITECTURE.md) và [README tổng thể](../README.md).
