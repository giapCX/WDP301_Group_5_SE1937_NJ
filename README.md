# Hướng dẫn chạy dự án và MongoDB

Hướng dẫn này dành cho Windows, PowerShell và MongoDB chạy local trên cổng `27017`.

## 1. Cài đặt dependencies

Mở terminal tại thư mục gốc dự án:

```powershell
npm.cmd --prefix BE install
npm.cmd --prefix FE install
```

## 2. Khởi động MongoDB

Đảm bảo dịch vụ **MongoDB Server** đang chạy. Có thể kiểm tra bằng PowerShell:

```powershell
Get-Service MongoDB
```

Nếu trạng thái không phải `Running`, mở PowerShell bằng quyền Administrator và chạy:

```powershell
Start-Service MongoDB
```

MongoDB Compass kết nối tới instance này bằng:

```text
mongodb://127.0.0.1:27017
```

## 3. Cấu hình backend

Tạo file `.env` nếu chưa có:

```powershell
Copy-Item BE/.env.example BE/.env
```

Với MongoDB standalone mặc định, mở `BE/.env` và đặt URI như sau (không thêm `?replicaSet=rentalLocal`):

```env
MONGO_URI=mongodb://127.0.0.1:27017/tourist_car_rental_demo
```

`BE/.env.example` dùng URI có replica set cho môi trường hỗ trợ transaction. Nếu dùng standalone như hướng dẫn này, hãy bỏ phần `?replicaSet=rentalLocal`.

## 4. Nạp dữ liệu mẫu vào MongoDB

Chạy từ thư mục gốc:

```powershell
npm.cmd --prefix BE run seed
```

Lệnh này tạo database `tourist_car_rental_demo`, các collection và dữ liệu mẫu. Seed chỉ thêm ID mẫu chưa có; chạy lại không ghi đè document hiện có. Trong Compass, kết nối `localhost:27017` rồi bấm **Refresh** để thấy database.

Có thể kiểm tra dữ liệu mẫu mà không ghi vào database:

```powershell
npm.cmd --prefix BE run seed:check
```

## 5. Chạy ứng dụng

Chạy cả backend và frontend từ thư mục gốc:

```powershell
npm.cmd run dev
```

Hoặc mở hai terminal riêng:

```powershell
npm.cmd --prefix BE start
```

```powershell
npm.cmd --prefix FE run dev
```

Backend chạy tại `http://localhost:9999`; frontend thường chạy tại `http://localhost:5173`.

## Lưu ý về transaction và replica set

MongoDB standalone trên `27017` chạy được các chức năng database thông thường. Các nghiệp vụ booking dùng transaction cần MongoDB replica set. Nếu gặp lỗi transaction yêu cầu replica set, cần cấu hình dịch vụ MongoDB thành replica set `rentalLocal` rồi dùng URI có `?replicaSet=rentalLocal`. Không chạy `npm run db:local` khi dịch vụ MongoDB standalone đang chiếm cổng `27017`; script sẽ báo cổng bị chiếm. Xem hướng dẫn dữ liệu mẫu chi tiết tại `BE/data/sample/README.md`.
