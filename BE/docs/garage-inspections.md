# API kiểm định đầu vào — Garage Staff

Base URL: `http://127.0.0.1:5000/api/garage`. API xử lý **kiểm định onboarding trước khi tiếp nhận xe từ chủ xe**. FE `/garage` đã nối các API này qua workspace; xem [luồng Garage Staff](garage-staff.md). Kiểm định định kỳ và duyệt kết quả của Manager để bước sau.

## Cấu hình và quyền

Dùng JWT trả về từ `POST /api/auth/login`, như [luồng tiếp nhận](garage-intakes.md). Tài khoản phải active, có permission **`vehicle.inspect`** ở role chính hoặc role bổ sung. Permission này độc lập với `vehicle.intake`; không bắt buộc có cả hai. Quyền được đọc lại từ database ở mỗi request.

```http
Authorization: Bearer <JWT-tu-login>
Content-Type: application/json
```

Nhân viên lập biên bản được lấy từ tài khoản đã xác thực bằng JWT. Không gửi ID nhân viên để giả lập đăng nhập, không nhúng token vào source/build FE. Token dev `GARAGE_API_TOKEN` và cấu hình `GARAGE_STAFF_ID` không còn được sử dụng.

**MongoDB 6.0+** để dùng partial unique index chống hai biên bản mở cho cùng xe. GET và lưu/sửa nháp dùng được với standalone; **gửi đề xuất cần replica set hoặc Atlas** để ghi transaction. Chạy `npm run db:setup` sau khi cập nhật source. API cũng tự đảm bảo index trước khi tạo/gửi biên bản; có dữ liệu mở trùng thì trả `503` để kiểm tra, không tự xóa bản ghi.

## Endpoints

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/inspection-vehicles?q=&page=1&limit=12` | Xe chờ kiểm định/bổ sung hồ sơ, kèm điều kiện tạo biên bản |
| GET | `/vehicles/:vehicleId/inspection-eligibility` | Kiểm tra điều kiện, biên bản đang mở, số km tối thiểu |
| GET | `/inspections?status=all&mine=false&q=&page=1&limit=12` | Danh sách biên bản onboarding |
| GET | `/inspections/:id` | Biên bản và điều kiện hiện tại |
| POST | `/inspections` | Tạo bản nháp, trả `201` |
| PATCH | `/inspections/:id` | Cập nhật nháp có version |
| POST | `/inspections/:id/submit` | Gửi đề xuất cho Manager, trả `200` |

Danh sách trả `{ data: [...], pagination: { page, limit, total, totalPages } }`. `q` tìm tên hãng, mẫu xe hoặc biển số, không phân biệt hoa thường; các ký tự regex được hiểu là ký tự thường. Tối đa 100 bản ghi/trang. `status` nhận `all`, `draft`, `pending`, `approved`, `revision_required`, `rejected`. `mine=true` chỉ lấy biên bản của nhân viên hiện tại; mặc định xem danh sách chung vì chưa có schema phân công theo chi nhánh. Danh sách xe chờ kiểm định chỉ dùng q/page/limit.

Người có quyền inspect được xem biên bản chung, nhưng **chỉ nhân viên đứng tên `garage_staff_id` mới được sửa/gửi bản nháp**. Không có endpoint duyệt, gán lại nhân viên hoặc thay đổi kết quả Manager trong API này.

## Luồng thực hiện

### 1. Chọn xe

Xe phải có `onboarding_status` là `submitted` hoặc `revision_required`, `physical_status` là `with_owner` hoặc `returned_to_owner`. Không được tạo thêm khi đã có biên bản onboarding `draft`/`pending`.

GET eligibility trả:

```json
{
  "data": {
    "eligible": true,
    "blockers": [],
    "vehicle": { "_id": "...", "brand": "Toyota", "model": "Vios" },
    "owner": { "_id": "...", "full_name": "..." },
    "baselineOdometerKm": 10000,
    "openInspection": null
  }
}
```

Nếu có `openInspection`, mở biên bản đó. `eligible` ở danh sách xe nghĩa là có thể **tạo biên bản mới**; ở chi tiết nháp hiện có, API bỏ qua chính nháp đó khi kiểm tra trùng. Điều kiện nghiệp vụ không thay thế kiểm tra quyền sửa theo nhân viên.

### 2. Tạo bản nháp

```json
{
  "vehicleId": "<ObjectId xe>",
  "odometerKm": 10025,
  "fuelLevelPct": 70,
  "condition": {
    "exterior": "good",
    "interior": "good",
    "engine": "good",
    "tires": "good",
    "note": "",
    "photoKeys": ["inspections/vehicle-01/front.jpg"]
  },
  "recommendation": "pass"
}
```

Tạo nháp chỉ bắt buộc `vehicleId`. Các trường báo cáo được phép thiếu và bổ sung sau. BE tự đặt `inspection_type: onboarding`, `approval_status: draft`, `garage_staff_id` từ tài khoản hiện tại, `version: 0`. Nháp chưa có `inspected_at`, không được coi là kết quả đã kiểm tra.

`condition` nhận `good`, `attention`, `damaged` cho bốn hạng mục. Ghi chú tối đa 1500 ký tự. `photoKeys` tối đa 4 khóa, mỗi khóa 250 ký tự; không nhận URL/base64 hoặc đường dẫn traversal. Upload qua `POST /api/garage/photos` trước để có key; ảnh không bắt buộc.

`recommendation` theo schema BE:

| API/DB | Ý nghĩa | Giá trị ở FE demo hiện tại |
| --- | --- | --- |
| `pass` | Đề xuất đạt | `pass` |
| `requires_repair` | Yêu cầu sửa chữa/bổ sung | `revision` |
| `fail` | Không đạt | `reject` |

Khi nối FE cần chuyển giá trị theo bảng này; không gửi nguyên `revision`/`reject` lên API.

### 3. Lưu nháp

```json
{
  "version": 0,
  "condition": { "note": "Cần kiểm tra lại cản sau.", "exterior": "attention" },
  "recommendation": "requires_repair"
}
```

Các trường trong condition được ghép với báo cáo cũ. `photoKeys` nếu gửi sẽ thay toàn bộ danh sách, dùng `[]` để xóa. Version tăng sau mỗi lần cập nhật; version cũ trả `409`, client cần GET lại. Không được đổi vehicleId, actor, inspection_type, approval_status, trường duyệt hay thời gian do server cấp.

### 4. Gửi đề xuất

```json
{ "version": 1 }
```

BE kiểm tra lại điều kiện xe trong transaction, yêu cầu đủ bốn đánh giá, số km nguyên không nhỏ hơn mức đã ghi nhận trong lịch sử kiểm định đã quyết định hoặc tiếp nhận hoàn tất, nhiên liệu/pin nguyên từ 0–100 và đề xuất hợp lệ.

- Bất kỳ hạng mục bất thường nào đều cần ghi chú.
- Không được đề xuất `pass` nếu còn `attention`/`damaged`.
- `requires_repair`/`fail` luôn cần ghi rõ lý do, kể cả khi bốn hạng mục đều good.

Thành công: `approval_status: pending`, ghi `inspected_at`/`submitted_at` từ server, tăng version, tạo một audit `vehicle.inspection.submitted`. BE cập nhật metadata `inspection_workflow_version` trên xe để phát hiện thay đổi đồng thời, **không tự đổi onboarding_status, physical_status hoặc ghi người duyệt Manager**.

Transaction lỗi sẽ rollback biên bản, metadata xe và audit. Kết quả `{ data: <biên bản>, replayed: false }`. Gửi lại cùng ID/version đã dùng thành công trả `replayed: true`, không thêm audit; nếu Manager đã xử lý, trả trạng thái hiện tại của biên bản. Version khác trả `409`.

### 5. Chờ Manager

`pending` là chờ duyệt, tương ứng `submitted` trên FE demo. Biên bản từ pending trở đi chỉ được xem qua API Garage Staff. Manager quyết định `approved`, `revision_required` hoặc `rejected` ở luồng riêng, chưa triển khai ở đây.

Biên bản cũ được giữ nguyên lịch sử. Khi Manager yêu cầu sửa/bổ sung và xe ở trạng thái phù hợp, nhân viên có thể tạo **vòng kiểm định mới**. Partial unique index tự giải phóng khóa khi biên bản cũ không còn draft/pending.

## Lỗi và kiểm thử

Lỗi chuẩn: `{ error: { message, details?: { blockers: [...] } } }`. Mã thường gặp: `400` dữ liệu không hợp lệ, `401` token sai/thiếu, `403` sai quyền/người lập, `404` không tồn tại, `409` trùng biên bản/sai trạng thái/version cũ, `503` thiếu cấu hình/replica set hoặc index chưa sẵn sàng.

Trong thư mục BE chạy `node --test` hoặc riêng `node --test test/garage-inspections.test.js`. Test dùng chung helper replica set tạm như intake, tạo database `xedi_inspection_test_<uuid>` riêng và tự dọn; không ghi vào database ứng dụng. Có thể cấu hình `MONGOD_BINARY` hoặc `INTAKE_TEST_MONGODB_URI` như tài liệu intake.
