# Dữ liệu mẫu MongoDB

17 file JSON, tổng 71 document, tương ứng 17 collection. Dữ liệu giả lập được xuất từ src/config/sample-data.js, không phải bản sao database cá nhân. Không có _id; MongoDB tự tạo _id khi import. Các ID nghiệp vụ và liên kết vẫn là Number.

Ngày dùng Extended JSON dạng { "$date": "2026-12-03T01:00:00Z" } để MongoDB import thành Date. Không chuyển các object $date thành chuỗi bằng JSON.parse rồi insert trực tiếp; dùng công cụ hiểu MongoDB Extended JSON hoặc BSON.EJSON.parse.

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

Import JSON không tự tạo unique index hay validator. Dùng npm run seed nếu muốn tạo index và chỉ thêm ID chưa có; seed không ghi đè dữ liệu hiện hữu. Không import JSON lặp lại vào database đã có dữ liệu seed.

Tạo lại các file: node scripts/export-sample-json.js.

Tài khoản demo: demo1@example.com đến demo9@example.com, mật khẩu Demo@12345 (hash scrypt). Auth thật vẫn cần tích hợp. Các yêu cầu đổi lịch chỉ là lịch sử giả lập, không tự áp dụng thay đổi vào booking.
