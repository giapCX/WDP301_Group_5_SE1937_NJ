# Luồng Garage, Operator Staff và Manager

## Kiểm định đầu vào

1. Operator xem hồ sơ xe và phân công nhân viên Garage có quyền `vehicle.inspect` qua `POST /api/operator/vehicles/:id/inspection-schedule`.
2. Garage lập/gửi biên bản kiểm định qua `/api/garage/inspections`; Operator không duyệt hồ sơ xe.
3. Manager xem chứng cứ và quyết định qua `PATCH /api/manager/vehicles/:id/review`. Xe chỉ được duyệt khi biên bản mới nhất đã gửi và đạt, các giấy tờ cần thiết hợp lệ.
4. Sau khi duyệt, Garage tiếp nhận xe theo luồng `/api/garage/intakes`. Tin xe chỉ được Manager xuất bản khi xe đã được duyệt, ở gara, có hợp đồng quản lý hiệu lực và biên bản tiếp nhận hoàn tất.

Lịch phân công tạo biên bản `draft`, không tự phê duyệt xe. Mỗi xe chỉ có một biên bản onboarding đang mở; Garage gửi biên bản rồi Manager mới có thể quyết định. Operator chỉ đổi lịch/người phụ trách khi biên bản còn `draft`, dùng version; không sửa kết quả đã gửi. Dữ liệu kiểm định cũ và lịch sử quyết định được giữ lại. Chi tiết API/quyền xem [nghiệp vụ Operator Staff](operator-staff.md).

## Booking và tin xe

- Manager xử lý yêu cầu thuê tại `GET /api/manager/bookings` và `PATCH /api/manager/bookings/:id/decision`. Duyệt booking chuyển sang `awaiting_payment` với hạn thanh toán 15 phút; từ chối yêu cầu lý do. Booking hết hạn được dọn khỏi hàng chờ theo quy tắc hold hiện có.
- Manager quản lý tin xe tại `GET /api/manager/listings`, `PATCH /api/manager/listings/:id` và `PATCH /api/manager/listings/:id/review`. Các điều kiện xuất bản tiếp tục được kiểm tra ở API và trong transaction.
- Các endpoint và giao diện Operation cũ đã được gỡ. Không xóa collection hoặc dữ liệu booking, tin xe, xe hay hồ sơ lịch sử.

## Sự cố

Garage/Operator ghi nhận sự cố và chứng cứ; Operator cập nhật thông tin, đính kèm biên bản riêng tư rồi chuyển hồ sơ bằng `POST /api/operator/incidents/:id/submit`. Manager xem hồ sơ tại `/api/manager/incidents` và tự quyết định theo thẩm quyền. Nếu cần, Manager yêu cầu bổ sung bằng `PATCH /api/manager/incidents/:id/review` với `action: request_information`; chỉ khi hồ sơ ở `need_more_information` Operator mới có thể sửa và gửi lại. Operator không đưa ra kết luận pháp lý, mức bồi thường hoặc quyết định trừ cọc.

Manager tiếp tục xử lý các yêu cầu bồi thường lịch sử đã có trên hồ sơ. Hồ sơ không gắn booking đúng xe không được dùng để trừ cọc renter. Kết luận hoặc quyết định bồi thường không tự chuyển xe ra khỏi `maintenance`.

Garage upload ảnh qua `POST /api/garage/photos`. Manager và Operator có quyền đọc hồ sơ sự cố được phép xem ảnh qua `GET /api/garage/photos/:owner/:name`; ảnh không được công khai.

## Kiểm thử

`BE/test/contracts.test.js`, `BE/test/renter.test.js`, `BE/test/operator.test.js` và `BE/test/manager-garage-workflow.test.js` bao phủ onboarding, duyệt booking/tin xe, quyền Operator và luồng sự cố. Các kiểm thử dùng database tạm; không sửa database ứng dụng.
