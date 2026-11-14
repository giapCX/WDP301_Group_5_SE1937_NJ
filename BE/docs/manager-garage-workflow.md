# Luồng Garage, Operator Staff và Manager

## Kiểm định đầu vào

### Tiêu chí quyết định cho Manager

Manager duyệt tính đầy đủ và nhất quán của hồ sơ, không tự chẩn đoán động cơ/phanh. Kết luận kỹ thuật thuộc Garage Staff và phải đi cùng checklist, phương pháp/ghi chú, số đo và ảnh. Khi xe có bản khai hiện trạng, chủ xe phải xác nhận đúng phiên bản báo cáo; bất đồng hoặc phản hồi phiên bản cũ không đủ điều kiện duyệt.

| Kết quả hồ sơ | Quyết định phù hợp |
|---|---|
| Checklist đủ 10 mục; không có mục `fail`/`unverified`; ngoại lệ nhỏ có ghi chú và ảnh; Garage đề xuất `pass`; chủ xe đồng ý đúng phiên bản; hồ sơ giấy tờ đủ | Duyệt và chuyển sang hoàn tất/ký hợp đồng quản lý |
| Thiếu giấy tờ, ảnh, giải thích chênh lệch hoặc cần kiểm định lại | Yêu cầu bổ sung/kiểm định lại, nêu cụ thể hạng mục và giữ hồ sơ ở `revision_required` |
| Garage kết luận `fail`, không thể đáp ứng điều kiện tiếp nhận hoặc hồ sơ không có căn cứ phù hợp | Từ chối, lưu lý do trong lịch sử (`rejected`) |

`approved` là quyết định hồ sơ onboarding, không có nghĩa xe đã vào gara. Xe chỉ chuyển `at_garage` sau khi Garage lập biên bản tiếp nhận và các bên xác nhận hợp lệ. Sau từng chuyến thuê, biên bản nhận trả phải so với biên bản giao của chính booking đó; lỗi mới/nặng thêm tạo sự cố, Operator xác minh và Manager quyết định đề xuất bồi thường ở luồng riêng. Không dùng kiểm định onboarding để kết luận lỗi phát sinh sau chuyến thuê.

1. Operator phân công Garage qua `POST /api/operator/vehicles/:id/inspection-schedule`.
2. Garage lập và gửi biên bản qua `/api/garage/inspections` với phiên bản hiện tại.
3. Manager xem biên bản onboarding mới nhất và quyết định qua `PATCH /api/manager/vehicles/:id/review`.
4. Sau khi duyệt và hoàn tất hợp đồng quản lý, Garage tiếp nhận xe. Manager chỉ xuất bản tin khi xe đã duyệt, ở gara, có hợp đồng quản lý hiệu lực và biên bản tiếp nhận hoàn tất.

Lịch phân công tạo biên bản `draft`, không tự phê duyệt xe. Mỗi xe chỉ có một biên bản onboarding đang mở; Operator chỉ đổi lịch/người phụ trách khi biên bản còn `draft`, dùng version; không sửa kết quả đã gửi. Operator precheck không phải quyết định duyệt xe. Dữ liệu kiểm định cũ và lịch sử quyết định được giữ lại. Chi tiết API/quyền xem [nghiệp vụ Operator Staff](operator-staff.md).

## Booking và tin xe

- Manager xử lý yêu cầu thuê tại `GET /api/manager/bookings` và `PATCH /api/manager/bookings/:id/decision`. Duyệt booking chuyển sang `awaiting_payment` với hạn thanh toán 15 phút và tự lập hợp đồng thuê để Renter ký; Operator tiếp nhận sau chữ ký Renter rồi Manager ký phía XeDi. Mã ưu đãi có thể cập nhật hợp đồng chưa ký. Từ chối yêu cầu lý do. Booking hết hạn được dọn khỏi hàng chờ theo quy tắc hold hiện có.
- Manager quản lý tin xe tại `GET /api/manager/listings`, `PATCH /api/manager/listings/:id` và `PATCH /api/manager/listings/:id/review`. Các điều kiện xuất bản tiếp tục được kiểm tra ở API và trong transaction.
- Các endpoint và giao diện Operation cũ đã được gỡ. Không xóa collection hoặc dữ liệu booking, tin xe, xe hay hồ sơ lịch sử.

## Sự cố

Garage/Operator ghi nhận sự cố và chứng cứ; trước khi chuyển hồ sơ bằng `POST /api/operator/incidents/:id/submit`, Operator phải xác nhận xe bị thu giữ hay không. Đây chỉ là ghi nhận, không tự đổi trạng thái xe, booking hoặc tiền cọc. Manager xem hồ sơ tại `/api/manager/incidents` và tự quyết định theo thẩm quyền. Nếu cần, Manager yêu cầu bổ sung bằng `PATCH /api/manager/incidents/:id/review` với `action: request_information`; chỉ khi hồ sơ ở `need_more_information` Operator mới có thể sửa và gửi lại. Operator không đưa ra kết luận pháp lý, mức bồi thường hoặc quyết định trừ cọc.

Manager tiếp tục xử lý các yêu cầu bồi thường lịch sử đã có trên hồ sơ. Hồ sơ không gắn booking đúng xe không được dùng để trừ cọc renter. Kết luận hoặc quyết định bồi thường không tự chuyển xe ra khỏi `maintenance`.

Garage upload ảnh qua `POST /api/garage/photos`. Manager và Operator có quyền đọc hồ sơ sự cố được phép xem ảnh qua `GET /api/garage/photos/:owner/:name`; ảnh không được công khai.

## Kiểm thử

`BE/test/contracts.test.js`, `BE/test/renter.test.js`, `BE/test/operator.test.js` và `BE/test/manager-garage-workflow.test.js` bao phủ onboarding, duyệt booking/tin xe, quyền Operator và luồng sự cố. Các kiểm thử dùng database tạm; không sửa database ứng dụng.
