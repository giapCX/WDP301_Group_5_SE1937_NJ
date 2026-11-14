# Backend XeDi

Hướng dẫn dành cho thành viên phát triển API XeDi. Backend chạy trên Node.js và Express, dùng Mongoose để truy cập MongoDB.

## Các nhóm API

- Auth xử lý đăng nhập, đăng ký và khôi phục mật khẩu. Homepage và Listings phục vụ tìm xe, xem xe và dữ liệu công khai.
- Owner quản lý hồ sơ xe, lịch kiểm tra và dữ liệu của chủ xe. Operator tiếp nhận hồ sơ, điều phối Garage, rà soát hợp đồng và điều tra sự cố.
- Garage quản lý kiểm định, tiếp nhận, bàn giao, nhận trả, ảnh và sự cố tại gara. Manager xử lý quyết định nghiệp vụ, hợp đồng, báo cáo, chính sách và nhân sự.
- Renter quản lý hồ sơ, booking, thanh toán và báo sự cố. Contracts thực hiện luồng lập và ký hợp đồng. Identity Verifications là API riêng cho hồ sơ xác minh.

## Kiến trúc theo tầng

- src/server.js khởi động server và kết nối DB. src/app.js gắn middleware, router theo tiền tố /api và endpoint /api/health.
- Routes khai báo endpoint và ghép middleware với controller. Controller đọc tham số HTTP, gọi service rồi trả response. Service kiểm tra quyền nghiệp vụ, trạng thái và điều phối giao dịch.
- Repository tập trung truy vấn và ghi dữ liệu. Model định nghĩa schema, kiểu dữ liệu và ràng buộc. Middleware xử lý xác thực và lỗi dùng chung. Validator kiểm tra dữ liệu đầu vào.
- src/database quản lý danh sách collection, index và seed. BE/data chứa dữ liệu khởi tạo. BE/scripts chứa lệnh setup, seed và các tác vụ vận hành.

## Luồng cần đối chiếu khi sửa API

- Yêu cầu thuê tạo hợp đồng. Khách thuê ký, Operator rà soát và Manager ký trước khi mở thanh toán. Garage lập biên bản giao và nhận trả xe.
- Operator tiếp nhận và bổ sung chứng cứ sự cố trước khi gửi Manager. Các quyết định và khoản đối soát phải gắn với hồ sơ, căn cứ và lịch sử xử lý.

## Quy tắc phát triển

- Đặt tên file theo mẫu nghiệp-vụ.tầng.js. Dùng lại connection và truyền dependency khi ghép module. Đặt truy vấn trong repository, quy tắc chuyển trạng thái trong service và xử lý HTTP trong controller.
- Kiểm tra quyền và phạm vi tài nguyên trên server. Giữ định dạng lỗi { error: { message, details? } }, đồng thời giới hạn dữ liệu nhạy cảm trong response và log.
- Các bước ghi nhiều bản ghi như giao nhận xe cần dùng cùng session trong transaction. Bảo vệ thao tác lặp và cập nhật đồng thời bằng điều kiện trạng thái hoặc version. Lưu audit khi nghiệp vụ có yêu cầu truy vết.
- Giữ tương thích dữ liệu cũ khi đổi schema. Xác minh index bằng db:setup. Seed thêm dữ liệu theo ID và giữ bản ghi đã tồn tại. Chỉ seed database được giao khởi tạo.
- Dùng quyền tải riêng tư cho tài liệu và ảnh nghiệp vụ. MongoDB lưu key tệp. Dùng cùng cấu hình Cloudinary khi các môi trường cần truy cập cùng tệp.

## Cấu hình và kiểm tra

- Dùng Node.js từ 20.19.0 theo BE/package.json. Tạo BE/.env từ BE/.env.example khi chưa có. Điền MONGODB_URI và MONGODB_DB_NAME. Với Atlas, tài khoản DB và IP kết nối cần được cấp quyền. Giữ thông tin đăng nhập và secret ngoài Git.
- Các biến Cloudinary, SMTP và cờ mô phỏng nằm trong BE/.env.example. Dùng replica set cho luồng transaction. Test tích hợp cần mongod hoặc replica set kiểm thử riêng.

```bash
npm run install:all
npm run db:setup
npm run db:seed
npm run dev:be
npm --prefix BE test
```

- Kiểm tra GET /api/health trên 127.0.0.1:5000. Khi chạy test với cấu hình local có bật demo renter, đặt RENTER_DEMO_SERVICES=false cho tiến trình test để kiểm tra chế độ OTP chưa cấu hình.
