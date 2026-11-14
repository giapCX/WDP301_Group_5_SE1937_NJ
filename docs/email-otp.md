# Cấu hình OTP email

Đăng ký: nhập email → Gửi mã OTP qua email → nhập mã và hoàn tất thông tin → Tạo tài khoản. Chỉ tạo tài khoản khi OTP đúng. Không gửi OTP qua số điện thoại.

Quên mật khẩu: chọn Quên mật khẩu tại trang đăng nhập → nhập email đã đăng ký → gửi và nhập OTP → nhập/xác nhận mật khẩu mới → Đặt lại mật khẩu. Thành công tự trở về form đăng nhập, dùng mật khẩu mới.

## Cấu hình backend

Chạy `npm install` trong thư mục BE. Điền trực tiếp vào `BE/.env` (không gửi mật khẩu vào chat, không commit file này):

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM="XeDi <your-email@gmail.com>"
```

Nếu dùng Gmail, bật xác minh hai bước và tạo App Password tại phần bảo mật tài khoản Google; dùng App Password làm SMTP_PASS. Nếu tài khoản không hỗ trợ App Password, dùng dịch vụ SMTP khác và thông số của nhà cung cấp. Cổng 465 sử dụng TLS trực tiếp; cổng 587 sử dụng STARTTLS. MAIL_FROM phải được nhà cung cấp cho phép gửi.

Khởi động MongoDB replica set (`npm run db:local` nếu dùng dữ liệu local), sau đó khởi động lại backend (`npm run dev`) và frontend. Đăng ký bằng email thật chưa có tài khoản và kiểm tra hộp thư/thư rác. Sau đó thử Quên mật khẩu, xác nhận mật khẩu cũ bị từ chối và mật khẩu mới đăng nhập được.

Mã có hiệu lực 5 phút, tối đa 5 lần kiểm tra, chỉ dùng một lần và đúng mục đích. Giới hạn gửi lại 60 giây theo email/mục đích. MongoDB lưu mã băm, không trả OTP ra API. Thiếu/sai SMTP sẽ báo lỗi; không dùng REN­TER_DEMO_SERVICES để thay thế gửi email. Các thông số thời hạn/giới hạn này là lựa chọn kỹ thuật, cần chốt lại nếu tài liệu nghiệp vụ có quy định khác.

Kiểm thử tự động sử dụng bộ gửi email giả lập trên cơ sở dữ liệu tạm; không chứng minh thư đến hộp thư thật. Cần điền SMTP rồi kiểm tra gửi thư thực tế.
