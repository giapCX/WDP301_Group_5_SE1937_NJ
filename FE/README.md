# Frontend XeDi

Hướng dẫn dành cho thành viên phát triển giao diện XeDi. Mỗi chức năng có thư mục riêng trong src/features và dùng chung lớp giao tiếp API.

## Chức năng theo vai trò

- Khách vãng lai tìm xe và xem chi tiết xe. Khách thuê quản lý hồ sơ, gửi yêu cầu thuê, ký hợp đồng, thanh toán, theo dõi nhận trả xe và gửi báo cáo sự cố.
- Chủ xe gửi hồ sơ xe, đặt lịch kiểm tra sau khi hồ sơ được xác thực, xem biên bản và hợp đồng ủy quyền, theo dõi xe và sự cố.
- Operator xác thực hồ sơ xe, xác nhận lịch và phân công Garage, rà soát hồ sơ và hợp đồng thuê, tiếp nhận và chuyển sự cố cho Manager.
- Garage Staff thực hiện kiểm tra, tiếp nhận xe, lập biên bản giao nhận và ghi nhận hiện trạng hoặc sự cố.
- Manager xử lý hồ sơ xe, hợp đồng, quyết định sự cố, chính sách và nhân sự. Admin có không gian quản trị riêng. Mục xác minh giấy tờ có route riêng và quyền truy cập tương ứng.

## Kiến trúc theo chức năng

- src/app/App.js và src/app/router.js ghép ứng dụng và điều hướng theo hash. Thêm đường dẫn ở router khi bổ sung màn hình cấp ứng dụng.
- src/features nhóm chức năng theo vai trò hoặc nghiệp vụ. Page ghép màn hình, component xử lý trình bày, hook quản lý dữ liệu và thao tác, API client gọi endpoint. Tạo thư mục con khi có mã cần đặt trong đó.
- src/services/httpClient.js xử lý request API và gắn JWT. src/features/auth/session.js quản lý phiên. src/components chứa giao diện dùng chung, src/hooks chứa hook dùng chung.
- public/contract-templates chứa mẫu Word được tải khi xem hợp đồng. Tên file được khai báo trong src/features/contracts/contractPresentation.js.

## Quy tắc phát triển

- Giữ code ở feature đang sở hữu nghiệp vụ. Đặt tên component theo PascalCase và hook bắt đầu bằng use. Dùng component dùng chung cho modal, phân trang và các mẫu giao diện lặp lại.
- Đưa request vào lớp API của feature. Dùng dữ liệu server cho booking, hợp đồng, thanh toán và sự cố. Giữ quy tắc nghiệp vụ và kiểm tra quyền thực thi tại backend.
- Thiết kế đủ trạng thái tải, rỗng, lỗi và thành công. Khi lưu, chặn gửi lặp, hiển thị lỗi trong biểu mẫu và giữ nội dung đã nhập để người dùng sửa.
- Dùng nhãn tiếng Việt theo nghiệp vụ. Làm rõ trạng thái, người cần thao tác và bước tiếp theo. Bảng trên màn hình hẹp cần cuộn được và biểu mẫu cần dùng được bằng bàn phím.
- Giữ cấu trúc request, response và mã trạng thái thống nhất với BE. Thêm hoặc cập nhật test khi thay đổi hành vi quan trọng, nhất là quyền, lỗi lưu và các bước ký hay thanh toán.

## Chạy và kiểm tra

- Chạy tại thư mục gốc repo. Frontend mặc định ở localhost:3000 và proxy API tới backend ở 127.0.0.1:5000.

```bash
npm run install:all
npm run dev
npm run dev:fe
npm --prefix FE test -- --watchAll=false --runInBand
npm run build
```

- Kiểm tra trên trình duyệt với đúng vai trò. Với thay đổi liên quan sự cố hoặc hợp đồng, mở cùng một hồ sơ từ các vai trò liên quan và đối chiếu trạng thái sau từng thao tác.
