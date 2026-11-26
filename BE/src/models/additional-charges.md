# Additional Charges trong Booking

Không có collection/model AdditionalCharge riêng. Booking.additional_charges là mảng subdocument, định nghĩa tại additional-charge.schema.js. ID khoản phí là số nguyên an toàn được server sinh, duy nhất trong phạm vi booking. Không cho client sửa amount, status, created_by hoặc history. API PATCH sửa nháp nhận đầy đủ các field như POST và reason.

## API Operator

Tất cả yêu cầu guard Operator active hiện có; req.user phải do module auth đáng tin cậy cung cấp. Chưa có đăng nhập thì trả 401, không giả lập user.

| Method | URL | Chức năng |
| --- | --- | --- |
| GET | /api/operator/additional-charges | Danh sách các khoản trên toàn bộ booking |
| GET | /api/operator/bookings/:id/additional-charges | Danh sách theo booking |
| GET | /api/operator/bookings/:id/additional-charges/:chargeId | Chi tiết và lịch sử |
| POST | /api/operator/bookings/:id/additional-charges | Tạo nháp |
| PATCH | /api/operator/bookings/:id/additional-charges/:chargeId | Sửa nháp |
| PATCH | /api/operator/bookings/:id/additional-charges/:chargeId/confirm | Xác nhận |
| PATCH | /api/operator/bookings/:id/additional-charges/:chargeId/cancel | Hủy khoản nháp/đã xác nhận |
| PATCH | /api/operator/bookings/:id/additional-charges/:chargeId/resolve-dispute | Giải quyết tranh chấp |

GET danh sách: page=1, limit=10 (tối đa 10), status=draft|confirmed|disputed|cancelled, type=overtime|extra_km|waiting|other. Danh sách toàn hệ thống hỗ trợ booking_id. Trả {success:true,data:{items,total,page,limit,total_pages}}. Chi tiết và mutation trả {success:true,data:{booking_id,additional_charge,charge}}; tạo thành công HTTP 201, còn lại 200.

POST và PATCH sửa nháp:

```json
{
  "type": "waiting",
  "description": "Chờ thêm theo yêu cầu khách",
  "quantity": 2,
  "unit_price": 100000,
  "evidence": ["https://example.com/evidence.jpg"],
  "reason": "Đối soát lại số giờ chờ"
}
```

reason bắt buộc khi sửa, không bắt buộc tạo. amount = Math.round(quantity * unit_price). Đơn giá là số nguyên VND dương; số lượng >=0.001, tối đa 1 triệu; thành tiền tối đa 1 nghìn tỷ VND. Giới hạn 100 khoản/booking để giới hạn document. Đơn vị do type quy định: overtime/waiting là giờ, extra_km là km, other là số đơn vị khoản phí. Giá nhập bởi Operator, chưa tự lấy bảng giá.

Xác nhận/hủy: {"reason":"Lý do xử lý"}. Giải quyết: {"resolution":"uphold","reason":"Bằng chứng xác nhận khoản phí"} hoặc resolution="waive" để miễn toàn bộ khoản. Không giảm một phần khoản đã xác nhận: phải hủy/miễn khoản cũ và lập khoản mới, giữ lịch sử.

## API Renter

- GET /api/renter/bookings/:id/additional-charges
- GET /api/renter/bookings/:id/additional-charges/:chargeId
- POST /api/renter/bookings/:id/additional-charges/:chargeId/dispute

Renter active chỉ truy cập booking thuộc mình. Body tranh chấp: {"reason":"Không đồng ý số giờ chờ","evidence":[]}. Bắt buộc khoản confirmed, chuyển disputed. Tranh chấp và xử lý được lưu trong history, kèm actor_id, thời điểm, lý do, số tiền và bằng chứng. Một tranh chấp đang mở phải được giải quyết trước khi mở lại.

Evidence chỉ là tối đa 10 URL HTTPS, không upload hay đọc nội dung URL; module upload bằng chứng bảo mật thực hiện sau. Lý do/mô tả tối đa 2000 ký tự.

## Tổng tiền và concurrency

Chỉ confirmed/disputed được tính vào bookings.additional_charge; draft/cancelled không tính. Tranh chấp giữ số tiền tới khi quyết định. Uphold giữ tổng, waive trừ số tiền. Transaction đọc và ghi booking cùng session; các thao tác đồng thời trên cùng booking có write conflict và retry, không cộng/trừ hai lần khi confirm/cancel lặp. Lịch sử và tổng cập nhật cùng nhau. Cần replica set local trên cổng MongoDB được cấu hình trong `BE/.env` (mặc định `27017`).

Dữ liệu cũ có tổng phụ phí nhưng không có chi tiết: giữ nguyên tổng đó làm phần chưa đối soát, không bịa khoản chi tiết. Mỗi thao tác chỉ cộng/trừ phần đóng góp của khoản đang xử lý. Vì vậy tổng mảng có thể chưa bằng tổng booking đối với dữ liệu cũ. Migration npm run db:embedded-charges chỉ thêm mảng [] còn thiếu, không reset tổng/mảng đã có. npm run seed cũng gọi migration.

Không sửa payments/refunds và không tự thu/hoàn tiền khi hủy/miễn phí. Chưa có thông báo, file upload, phê duyệt Manager hay frontend. Các phần đó được xử lý trong module tương ứng sau.

Lỗi: 400 dữ liệu sai, 401 thiếu đăng nhập, 403 sai role/chủ booking, 404 booking/khoản phí không có, 409 trạng thái không cho phép. Không có hard-delete để giữ dấu vết xử lý.

Test: npm run test:charges. Kiểm tra CRUD nháp, tính tiền, xác nhận đồng thời, tranh chấp, waive/uphold, hủy, lịch sử, phân trang và quyền truy cập trên database test riêng.
