# VietTour Mobility

Hướng dẫn cài đặt và chạy dự án trên Windows bằng PowerShell, kết nối MongoDB local và đăng nhập bằng tài khoản demo.

## Yêu cầu

- Node.js và npm.
- MongoDB Community Server đang chạy trên cổng `27017`.
- MongoDB Compass (không bắt buộc, dùng để xem database).

> MongoDB Compass chỉ là ứng dụng xem dữ liệu; cần chạy MongoDB Server riêng.

## 1. Cài dependencies

Mở PowerShell tại thư mục gốc dự án, nơi có `package.json`, rồi chạy:

```powershell
npm.cmd --prefix BE install
npm.cmd --prefix FE install
```

Dùng `npm.cmd` nếu PowerShell báo không cho chạy `npm.ps1`.

## 2. Cấu hình môi trường

Tạo file môi trường từ file mẫu nếu chưa có:

```powershell
if (!(Test-Path BE/.env)) { Copy-Item BE/.env.example BE/.env }
if (!(Test-Path FE/.env)) { Copy-Item FE/.env.example FE/.env }
```

Kiểm tra các giá trị sau:

**`BE/.env`**

```env
PORT=9999
MONGO_URI=mongodb://127.0.0.1:27017/tourist_car_rental_demo
CLIENT_ORIGIN=http://localhost:3000
NODE_ENV=development
```

**`FE/.env`**

```env
VITE_API_BASE_URL=/api
```

Frontend dùng Vite proxy để chuyển `/api` tới backend. Cách này tránh lỗi CORS thường gặp khi đặt URL API trực tiếp thành `http://localhost:9999/api`. Nếu `FE/.env` đã có `VITE_API_BASE_URL`, hãy sửa đúng dòng đó; không cần ghi đè các biến môi trường khác.

## 3. Khởi động MongoDB và nạp dữ liệu

Kiểm tra dịch vụ MongoDB trong PowerShell:

```powershell
Get-Service MongoDB
```

Nếu dịch vụ đang dừng, mở PowerShell bằng quyền Administrator và chạy:

```powershell
Start-Service MongoDB
```

Nạp tài khoản và dữ liệu mẫu vào database `tourist_car_rental_demo`:

```powershell
npm.cmd --prefix BE run seed
```

Seed chỉ thêm dữ liệu mẫu còn thiếu, không xóa hoặc ghi đè dữ liệu đang có. Có thể kiểm tra trước mà không thay đổi database:

```powershell
npm.cmd --prefix BE run seed:check
```

## 4. Chạy dự án

Từ thư mục gốc, chạy cả frontend và backend:

```powershell
npm.cmd run dev
```

Để dừng, nhấn `Ctrl+C` trong terminal đó.

Mặc định:

- Frontend: `http://localhost:3000`
- Trang đăng nhập: `http://localhost:3000/login`
- Backend API: `http://localhost:9999/api`
- MongoDB: `mongodb://127.0.0.1:27017`

Vite yêu cầu cổng `3000` chưa bị ứng dụng khác sử dụng. Backend dùng cổng `9999`.

### Chạy frontend và backend riêng

Nếu muốn mở hai terminal, chạy từ thư mục gốc dự án.

Terminal 1:

```powershell
npm.cmd --prefix BE start
```

Terminal 2:

```powershell
npm.cmd --prefix FE run dev
```

## 5. Đăng nhập tài khoản demo

Sau khi seed database và chạy dự án, mở `http://localhost:3000/login`.

Tài khoản Manager để xem dashboard:

```text
Email:     demo2@example.com
Mật khẩu: Demo@12345
```

Các tài khoản demo khác cũng dùng mật khẩu `Demo@12345`:

| Vai trò | Email |
| --- | --- |
| Admin | `demo1@example.com` |
| Manager | `demo2@example.com` |
| Operator | `demo3@example.com` |
| Garage staff | `demo4@example.com` |
| Driver | `demo5@example.com`, `demo6@example.com` |
| Renter | `demo7@example.com`, `demo8@example.com`, `demo9@example.com` |

Sau khi đăng nhập Manager, ứng dụng chuyển tới `/manager/dashboard`. Đây là tài khoản demo local, không dùng trên môi trường thật.

Các trang theo vai trò hiện có:

| Vai trò | Trang sau đăng nhập |
| --- | --- |
| Manager | `/manager/dashboard` |
| Operator | `/operator/bookings`; có thêm `/operator/dashboard`, `/operator/vehicles` và `/operator/trip-monitoring` |
| Garage staff | `/garage/tasks` |
| Driver | `/driver/dashboard` |
| Renter | `/renter/dashboard` |
| Admin | `/admin/roles-permissions` |

### Đăng ký tài khoản mới

Trang khởi động `/` là trang chủ dịch vụ. Trên thanh đầu trang có nút **Đăng nhập** và **Đăng ký**; cũng có thể mở trực tiếp `http://localhost:3000/login` hoặc `http://localhost:3000/register`. Trang `/register` mở thẳng biểu mẫu đăng ký. Nhập họ tên, số điện thoại, email và mật khẩu. Ứng dụng gửi mã OTP 6 chữ số tới email; mã hết hạn sau 10 phút và có thể gửi lại sau 60 giây. Tài khoản đăng ký mới có vai trò Người thuê.

Backend hiện gửi OTP qua Gmail. Để đăng ký hoạt động, điền tài khoản Gmail và **Google App Password** vào `BE/.env`:

```env
SMTP_USER=your-address@gmail.com
SMTP_PASS=your-google-app-password
```

Không dùng mật khẩu Gmail thông thường và không commit các giá trị này lên Git. Sau khi sửa `.env`, khởi động lại backend. Nếu chưa cấu hình SMTP, đăng nhập vẫn dùng được với tài khoản seed ở trên nhưng đăng ký mới sẽ không gửi được OTP.

Khi đã đăng nhập, trang `/login` ẩn lựa chọn đăng nhập/đăng ký và hiển thị trạng thái tài khoản. Trên dashboard Manager, nhấn **Đăng xuất** ở góc phải để xóa phiên và quay lại trang đăng nhập.

## 6. Xem database bằng MongoDB Compass

1. Kết nối Compass tới `mongodb://127.0.0.1:27017`.
2. Làm mới danh sách database.
3. Mở `tourist_car_rental_demo` và collection `users`, `vehicles`, `bookings`, `payments` hoặc collection cần xem.

## Xử lý lỗi đăng nhập thường gặp

### Trang báo không kết nối được máy chủ VietTour

- Đảm bảo `npm.cmd run dev` đang chạy và terminal không báo backend crash.
- Kiểm tra MongoDB Server đang chạy trên `27017`.
- Kiểm tra backend `PORT=9999` trong `BE/.env`.
- Đặt `VITE_API_BASE_URL=/api` trong `FE/.env`, sau đó dừng và chạy lại frontend để Vite nạp cấu hình mới.
- Mở trang bằng `http://localhost:3000`; không dùng một cổng khác nếu `CLIENT_ORIGIN` chưa được cấu hình cho cổng đó.

### Email hoặc mật khẩu không chính xác

- Chạy `npm.cmd --prefix BE run seed` để tạo các tài khoản demo.
- Dùng đúng `demo2@example.com` và `Demo@12345` cho vai trò Manager.
- Kiểm tra `MONGO_URI` trong `BE/.env` đang trỏ tới database `tourist_car_rental_demo`. Backend và lệnh seed phải dùng cùng URI.

### Cổng đã được sử dụng

- Frontend cần cổng `3000`; backend cần cổng `9999`; MongoDB cần cổng `27017`.
- Nếu Vite báo `Port 3000 is already in use`, đóng tiến trình frontend cũ rồi chạy lại.
- Nếu MongoDB Server đã chiếm `27017`, không chạy `npm run db:local`; hãy dùng instance MongoDB đó và URI `mongodb://127.0.0.1:27017/tourist_car_rental_demo`.

### Booking báo cần replica set

Các thao tác booking ưu tiên transaction khi MongoDB hỗ trợ replica set. Với MongoDB standalone hiện có, backend tự chuyển sang khóa lịch xe ngắn hạn được lưu trên document `vehicles`, nên có thể tiếp tục duyệt và áp dụng lịch mà không đổi instance hoặc database trong Compass. Khóa được giải phóng khi thao tác kết thúc; khóa sót do backend dừng được xem là cũ sau 5 phút. Replica set vẫn được khuyến nghị nếu chạy nhiều backend instance hoặc cần transaction đa collection đầy đủ.
