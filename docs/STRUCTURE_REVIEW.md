# Rà soát cấu trúc dự án — 28/10/2026

## Kết quả rà soát ban đầu

| Khu vực | Hiện trạng trước refactor | Ảnh hưởng |
| --- | --- | --- |
| Tổng thể | Tách `FE/`, `BE/`, có lệnh chạy từ root | Nền tảng phù hợp, giữ tên thư mục |
| FE routing | `App.js` vừa chọn trang theo hash vừa đặt title | Chuyển điều hướng vào `app/router.js` |
| FE auth | Trang đăng nhập nằm trong `components/Login`, trực tiếp gọi API và lưu storage | Khó phân biệt trang với component dùng chung, logic phiên bị lặp |
| FE homepage | `pages/HomePage.js` chứa tải metadata, tìm xe, loading/retry, tính thu nhập và JSX | Khó tái sử dụng, khó xác định phần cần sửa |
| FE listings | `VehicleCard` nằm trong components toàn cục | Thành phần nghiệp vụ chưa có feature sở hữu |
| BE routes | 3 router chứa cả kiểm tra đầu vào, nghiệp vụ và truy vấn MongoDB | Thay đổi API dễ tác động nhiều trách nhiệm trong cùng file |
| BE auth middleware | Nằm chung file router; catch rộng cả lỗi DB | Khó tìm và có thể trả 401 khi database lỗi |
| BE lỗi | 404 và error handler nằm trực tiếp trong app | Tách thành middleware để app tập trung ghép module |
| Tests | 12 test backend với MongoDB, 4 test UI | Có baseline để so sánh sau refactor |

## Thay đổi đã thực hiện

- FE tổ chức theo `app`, `features/auth`, `features/home`, `features/listings`; giữ component dùng chung trong `components`.
- Đưa endpoint vào feature API, tách hook đăng nhập, tải homepage và danh sách xe. HTTP transport ở `services/httpClient.js`.
- Đưa công cụ tính thu nhập vào component của home; `VehicleCard` thuộc listings.
- Tập trung lưu/xóa phiên; sửa trường hợp tài khoản cũ trong localStorage lấn át tài khoản mới đăng nhập bằng sessionStorage.
- BE tách 3 module thành routes/controller/service/repository; đưa middleware auth và lỗi về thư mục chung.
- Middleware auth chuyển lỗi database đến error handler, giữ lỗi token ở nhóm xác thực.
- Giữ tên thư mục FE/BE, các endpoint, response JSON và dữ liệu seed. Không thêm thư viện hoặc đổi lockfile.

## Kiểm chứng

Trước refactor: **12/12 backend**, **4/4 frontend** thành công.

Sau refactor: **15/15 backend**, **8/8 frontend** thành công và production build hoàn tất. Bổ sung test cho gửi form đăng nhập, chuyển kiểu lưu phiên, logout, dữ liệu user không hợp lệ, middleware auth và phân biệt lỗi database với lỗi xác thực. Cập nhật đường dẫn Tailwind scan theo vị trí mới của feature auth để giữ CSS đăng nhập trong bản build. Chi tiết lệnh và yêu cầu MongoDB nằm trong [hướng dẫn kiến trúc](ARCHITECTURE.md).

Đây là refactor cấu trúc và một số xử lý phiên/lỗi liên quan; chưa triển khai booking, đăng ký tài khoản hoặc cơ chế thu hồi JWT. Các giới hạn hiện có được ghi trong hướng dẫn kiến trúc để nhóm tiếp tục xử lý theo phạm vi chức năng.

## Tích hợp cập nhật — 09/11/2026

- Đã nhập commit `hieupn` vào nhánh `tungnq`: backend dùng Mongoose, model/schema, repository theo tầng, JWT xác thực Garage; nhận các tài liệu Markdown cập nhật từ nhánh này.
- Giữ và tích hợp tiếp Owner: feature FE có API/hooks/dialog; BE có routes/controller/service/repository dùng Mongoose. Đăng ký xe lưu giấy tờ riêng trong GridFS, ký thỏa thuận có phiên bản, người ký, thời điểm ký và audit log.
- Garage routes lắp ghép repository/service/controller trực tiếp và tiếp tục dùng middleware JWT, không dùng lại biến môi trường token Garage cũ.
- Manager page lấy dữ liệu và gọi thao tác qua feature hooks. Backend Manager dùng các layer Mongoose mới được nhập từ `hieupn`.
