# API tiếp nhận xe — Garage Staff

API nằm dưới `/api/garage`. Đây là luồng tiếp nhận xe từ chủ xe theo **hợp đồng quản lý**, khác với luồng nhận xe khách thuê trả. FE `/garage` đã nối API thật, gồm phụ kiện, lưu nháp và xác nhận; xem [luồng Garage Staff](garage-staff.md).

## Điều kiện sử dụng

- Node.js và MongoDB như cấu hình BE hiện tại. Chạy `npm run db:setup` để tạo collection/index.
- GET và lưu/sửa nháp dùng được với MongoDB standalone. **Xác nhận cần replica set hoặc Atlas** để thực hiện transaction. Standalone trả `503` và không xác nhận tiếp nhận.
- Đăng nhập qua `POST /api/auth/login` bằng tài khoản đang active. API gara dùng JWT do API đăng nhập cấp; kiểm tra quyền hiện tại trong database ở mỗi request.

Trong `BE/.env`:

```dotenv
JWT_SECRET=<bi-mat-ky-JWT-cua-backend>
# Ví dụ local replica set đã khởi tạo:
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
```

Gọi `POST /api/auth/login` với `{ "account": "<email-hoac-so-dien-thoai>", "password": "<mat-khau>" }` và lấy `data.token`. Không commit token hoặc đưa vào source/biến build FE. Tài khoản phải `account_status: active`, role chính hoặc role bổ sung có permission `vehicle.intake`. BE tự lấy actor từ tài khoản đã xác thực; không tin `staffId` hoặc `X-User-Id` do client gửi. `GARAGE_API_TOKEN` và `GARAGE_STAFF_ID` không còn được sử dụng.

Mọi request cần header:

```http
Authorization: Bearer <JWT-tu-login>
Content-Type: application/json
```

Chưa có schema phân công theo chi nhánh: người có quyền `vehicle.intake` được xem danh sách tiếp nhận chung. Chỉ người tạo biên bản được sửa hoặc xác nhận biên bản đó.

## Endpoints

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/intake-vehicles?q=&page=1&limit=12` | Xe đang ở chủ xe/đã trả chủ, kèm hợp đồng mới nhất và các lý do chưa đủ điều kiện |
| GET | `/vehicles/:vehicleId/intake-eligibility?managementAgreementId=:id` | Kiểm tra một xe và hợp đồng cụ thể |
| GET | `/intakes?status=all&q=&page=1&limit=12` | Danh sách biên bản, tìm hãng/mẫu/biển số; status: all, draft, completed |
| GET | `/intakes/:id` | Chi tiết biên bản và điều kiện hiện tại |
| POST | `/intakes` | Tạo nháp, trả `201` |
| PATCH | `/intakes/:id` | Lưu nháp với kiểm tra version |
| POST | `/intakes/:id/confirm` | Xác nhận tiếp nhận trong transaction |

Danh sách trả `{ data: [...], pagination: { page, limit, total, totalPages } }`; tối đa 100 bản ghi/trang. Chi tiết và tạo/sửa trả `{ data: {...} }`. Mã lỗi là `{ error: { message, details? } }`.

Xe trong danh sách chờ chưa chắc đủ điều kiện: đọc `eligible` và `blockers`. API không thay đổi dữ liệu kiểm định/hợp đồng để làm xe đủ điều kiện. Dữ liệu mẫu hiện tại có xe đã tiếp nhận và các mốc không đồng nhất, nên có thể chỉ thấy xe bị chặn.

## Luồng gọi mẫu

1. Gọi `/intake-vehicles` để lấy `vehicle._id`, `agreement._id`, `baselineOdometerKm`, thông tin kiểm định và lý do bị chặn. Nếu có `intakeId`, mở biên bản hiện có.
2. Tạo bản nháp:

```json
{
  "vehicleId": "<vehicle ObjectId>",
  "managementAgreementId": "<management agreement ObjectId>",
  "odometerKm": 16020,
  "fuelLevelPct": 70,
  "condition": {
    "exterior": "good",
    "interior": "good",
    "engine": "good",
    "tires": "good",
    "note": "Đã đối chiếu hiện trạng tại gara.",
    "accessories": ["vehicle_key", "registration_copy", "emergency_kit"],
    "photoKeys": ["intakes/vehicle-01/front.jpg"]
  }
}
```

Tạo nháp chỉ yêu cầu 2 ID; các trường biên bản được phép thiếu để bổ sung sau. Xe và hợp đồng phải tồn tại, khớp cả xe lẫn chủ xe. Mỗi hợp đồng có tối đa một biên bản tiếp nhận ban đầu; tạo trùng trả `409`. Biên bản lịch sử seed chưa có `status` được coi là `completed`, không sửa lại.

3. Lưu thay đổi bằng PATCH, gửi version đã đọc:

```json
{
  "version": 0,
  "fuelLevelPct": 75,
  "condition": { "note": "Đã kiểm tra lại nhiên liệu." }
}
```

Version tăng sau mỗi lần lưu. `condition` được ghép theo trường, không xóa các đánh giá đã lưu. Danh sách `photoKeys`/`accessories` nếu gửi sẽ thay toàn bộ danh sách cũ; gửi `[]` để xóa. Không cho đổi vehicleId/hợp đồng, actor, status, timestamp hoặc tự xác nhận chữ ký bằng PATCH. Version cũ trả `409`; client cần tải lại.

4. Xác nhận với version mới nhất:

```json
{ "version": 1, "ownerConfirmed": true }
```

BE kiểm tra lại trong transaction:

- Xe `onboarding_status: approved`; `physical_status` là `with_owner` hoặc `returned_to_owner`.
- Kiểm định **onboarding mới nhất** phải `approval_status: approved` và `recommendation: pass`.
- Hợp đồng khớp chủ xe/xe, `active`, đang trong thời hạn, có thời điểm ký của cả hai bên và có quyền `vehicle_custody`.
- Chưa có biên bản hoàn tất cho cùng hợp đồng.
- Số km nguyên, không âm, không nhỏ hơn số km ở kiểm định đầu vào mới nhất hoặc lần tiếp nhận hoàn tất gần nhất. Nhiên liệu/pin là số nguyên từ 0–100.
- Đủ bốn hạng mục `good`, `attention` hoặc `damaged`. Có hạng mục bất thường thì cần ghi chú. Trong phạm vi này, bất thường được ghi nhận, chưa tự tạo case hoặc quyết định bồi thường.
- `ownerConfirmed: true` là xác nhận của nhân viên rằng đã ghi nhận bàn giao từ chủ xe, **không phải chữ ký điện tử hay xác thực danh tính chủ xe**.

Thành công: biên bản thành `completed`, lưu nhân viên/thời điểm thực tế do server cấp, ghi xác nhận chủ xe, tăng version; xe thành `at_garage`; tạo một audit log `vehicle.intake.confirmed`. Không tự đăng tin xe hoặc sửa approval kiểm định/hợp đồng. Một thao tác lỗi sẽ rollback cả ba thay đổi.

Kết quả xác nhận: `{ data: <biên bản>, replayed: false }`. Gửi lại **cùng ID và version đã dùng để xác nhận thành công** trả `replayed: true`, không tạo thêm audit/biên bản. Version khác hoặc sửa biên bản đã hoàn tất trả `409`.

5. Gọi GET chi tiết/danh sách để hiển thị biên bản đã lưu.

Biên bản nhận **khóa file**, không nhận URL, binary hoặc base64. Tối đa 4 ảnh, mỗi key tối đa 250 ký tự. FE upload qua `POST /api/garage/photos` trước khi gửi key. Chưa cung cấp xuất PDF.

## Kiểm thử

Từ thư mục `BE`: `node --test`. Test API tìm xe cũ vẫn dùng dữ liệu seed của database cấu hình hiện tại, chỉ đọc.

Test intake tự chạy `mongod` replica set đơn node trên cổng ngẫu nhiên, đường dẫn dữ liệu tạm và database `xedi_intake_test_<uuid>` riêng. Nó không sửa MongoDB service hoặc database ứng dụng. Trên Windows tự tìm `Program Files/MongoDB/Server/*/bin/mongod.exe`; có thể đặt `MONGOD_BINARY` nếu cài ở vị trí khác. Hoặc cung cấp `INTAKE_TEST_MONGODB_URI` trỏ tới replica set kiểm thử. Dữ liệu test và tiến trình tạm được dọn sau khi chạy.

Test bao gồm xác thực/quyền, lưu nháp/version, hợp đồng và kiểm định không hợp lệ, xác nhận lặp/đồng thời, quyền sửa theo người tạo, dữ liệu seed cũ và rollback khi ghi audit thất bại.
