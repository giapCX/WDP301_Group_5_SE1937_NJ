# Dữ liệu mẫu MongoDB

17 file JSON, tổng 71 document, tương ứng 17 collection. Dữ liệu giả lập được xuất từ src/config/sample-data.js, không phải bản sao database cá nhân. Không có _id; MongoDB tự tạo _id khi import. Các ID nghiệp vụ và liên kết vẫn là Number.

Ngày dùng Extended JSON dạng { "$date": "2026-12-03T01:00:00Z" } để MongoDB import thành Date. Không chuyển các object $date thành chuỗi bằng JSON.parse rồi insert trực tiếp; dùng công cụ hiểu MongoDB Extended JSON hoặc BSON.EJSON.parse.

## Seed bằng script

Từ thư mục gốc repository chạy `npm run db:seed:sample`, hoặc từ `BE` chạy `npm run db:seed:sample`. Script đọc `MONGODB_URI` trong `BE/.env`, tạo database `tourist_car_rental_demo` nếu chưa có, rồi nạp 17 collection/71 document. Có thể đổi database đích bằng `SAMPLE_DB_NAME` hoặc `SEED_DB_NAME`.

Seed tạo unique index và chỉ thêm các ID chưa có, không ghi đè bản ghi cũ. Bộ dữ liệu dùng các ID nghiệp vụ số như `user_id`, `role_id`, `booking_id` và được sử dụng độc lập trong database `tourist_car_rental_demo`.

## MongoDB Compass

Kết nối mongodb://127.0.0.1:27018/?replicaSet=rentalLocal. Tạo database demo mới, tạo collection trùng tên file (ví dụ users), chọn Add Data > Import JSON or CSV file và chọn file tương ứng. Lặp lại cho các collection còn lại. Nên import vào database rỗng; import lặp có thể tạo trùng ID nghiệp vụ.

## mongoimport

Nếu có MongoDB Database Tools, chạy từ thư mục BE:

```powershell
Get-ChildItem -LiteralPath .\data\sample -Filter *.json | ForEach-Object {
  mongoimport --uri "mongodb://127.0.0.1:27018/tourist_car_rental_demo?replicaSet=rentalLocal" --collection $_.BaseName --file $_.FullName --jsonArray --stopOnError
  if ($LASTEXITCODE -ne 0) { throw "Import failed: $($_.Name)" }
}
```

Import JSON không tự tạo unique index hay validator. Dùng `npm run db:seed:sample` nếu muốn tạo index và chỉ thêm ID chưa có; seed không ghi đè dữ liệu hiện hữu.

Tạo lại các file: node scripts/export-sample-json.js.

Operator-only API đọc trực tiếp các collection nghiệp vụ trong database này. Màn hình operator không yêu cầu đăng nhập.

Các yêu cầu đổi lịch chỉ là lịch sử giả lập, không tự áp dụng thay đổi vào booking.
