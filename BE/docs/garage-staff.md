# Garage Staff — dữ liệu thật và luồng giao nhận

Frontend `/garage` gọi API và lưu nghiệp vụ trong MongoDB qua Mongoose. Không sử dụng dữ liệu mẫu hay localStorage cho công việc, biên bản và sự cố. Dữ liệu seed trong MongoDB vẫn hiển thị như các bản ghi hiện có.

## Kiến trúc

`routes → controller → service → repositories → Mongoose models`

- `garage-workspace.*`: tổng hợp công việc, số liệu giao diện, báo cáo của nhân viên và lịch sử từ dữ liệu thật.
- `garage-intake.*`, `garage-inspection.*`: tiếp nhận từ chủ xe và kiểm định onboarding đã có, nay được nối với frontend.
- `garage-handover.*`: bàn giao cho khách thuê và nhận trả, lưu nháp/version và xác nhận bằng transaction.
- `garage-incident.*`: ghi nhận sự cố; không thực hiện quyết định bồi thường.
- `garage-photo.*`: lưu/đọc tệp ảnh qua repository filesystem riêng tư.
- FE dùng `api/garageApi.js`, `hooks/useGarageWorkspace.js` và các component. Component không truy vấn MongoDB hoặc gọi fetch trực tiếp.

## Quyền và dữ liệu

Mọi endpoint cần `Authorization: Bearer <JWT từ POST /api/auth/login>`. Quyền được tải lại từ database ở mỗi request, không tin quyền/nhân viên do client gửi.

| Luồng | Permission |
| --- | --- |
| Kiểm định | `vehicle.inspect` |
| Tiếp nhận từ chủ xe | `vehicle.intake` |
| Bàn giao / nhận trả khách thuê | `handover.record` |
| Tạo/xem sự cố của mình | `case.report` |
| Workspace / ảnh | Có ít nhất một quyền ở trên |

Danh sách công việc dùng chung theo quyền, chưa có phân công theo chi nhánh. Chỉ người đứng tên biên bản được sửa/xác nhận nháp. Workspace đánh dấu nháp của người khác và biên bản đã gửi/hoàn tất là chỉ xem; backend vẫn kiểm tra lại khi ghi. Workspace lấy toàn bộ danh sách hiện tại, không cắt ngầm ở 100 bản ghi; tìm kiếm/lọc/xuất CSV đang thực hiện trên danh sách đó. Khi dữ liệu tăng lớn cần tách API danh sách có phân trang và API thống kê riêng.

## API bổ sung

Base URL: `/api/garage`.

| Method | URL | Chức năng |
| --- | --- | --- |
| GET | `/workspace` | `{ data: { tasks, incidents, history, vehicles, permissions } }` |
| GET | `/bookings/:bookingId/handover-eligibility?type=pickup` | Điều kiện, blockers và baseline; type cũng nhận `return` |
| POST | `/handovers` | Tạo nháp pickup/return |
| GET | `/handovers/:id` | Chi tiết và điều kiện hiện tại |
| PATCH | `/handovers/:id` | Cập nhật nháp với version |
| POST | `/handovers/:id/confirm` | Xác nhận với version và `renterConfirmed: true` |
| POST | `/incidents` | Tạo báo cáo; requestId chống gửi trùng |
| GET | `/incidents/:id` | Xem báo cáo của mình |
| POST | `/photos` | Upload ảnh, trả `{ data: { key, name } }` |
| GET | `/photos/:owner/:name` | Tải ảnh qua JWT, không phục vụ public static |

Danh sách handover/incident được cung cấp trong workspace. Các endpoint kiểm định/tiếp nhận xem [garage-inspections.md](garage-inspections.md) và [garage-intakes.md](garage-intakes.md).

### Lưu và xác nhận giao nhận

```json
{
  "bookingId": "<ObjectId>",
  "type": "pickup",
  "odometerKm": 10020,
  "fuelLevelPct": 80,
  "condition": {
    "exterior": "good", "interior": "good", "engine": "good", "tires": "good",
    "note": "", "photoKeys": []
  }
}
```

Tạo nháp chỉ cần bookingId/type; có thể chuẩn bị nháp khi chưa đủ điều kiện hoàn tất. PATCH dùng các trường báo cáo và `version`, không gửi lại bookingId/type. Xác nhận:

```json
{ "version": 0, "renterConfirmed": true }
```

- Pickup cần booking `confirmed`, xe đã duyệt và `at_garage`, hợp đồng thuê đã ký, hợp đồng quản lý còn hiệu lực/đúng xe và đủ quyền ủy quyền, khách thuê đang active và có KYC/giấy phép hợp lệ, tiền thuê và cọc đã được xác nhận từ dữ liệu thanh toán.
- Thành công pickup: biên bản `confirmed`, booking `ongoing`, xe `rented`, ghi thời điểm và audit do server cấp.
- Return cần booking `ongoing`, xe `rented`, có biên bản pickup đã xác nhận. Số km không được giảm so với pickup.
- Thành công return: booking `completed`, xe `at_garage`. Nếu có hạng mục xấu hơn pickup, tạo một sự cố `reported` và đưa xe về `maintenance` để chờ kiểm tra, không cho xuất hiện như xe sẵn sàng thuê. Hư hỏng đã có và không nặng hơn không tự tạo thêm sự cố.
- Không tự duyệt bồi thường, trừ cọc, hoàn cọc hoặc thu phí. Xác nhận khách thuê là ghi nhận của nhân viên, không phải chữ ký điện tử.
- Các ghi biên bản/booking/xe/sự cố/audit cùng transaction. Lỗi sẽ rollback. Gửi lại cùng ID/version đã xác nhận thành công trả `replayed: true`; không tạo lại biên bản, sự cố hoặc audit. Version cũ khác trả 409.
- Unique index `one_rental_handover_per_booking_type` ngăn hai nháp/biên bản cùng booking/type. Index có tên mới để cùng tồn tại với index thường cũ; không xóa index hoặc dữ liệu hiện có.

### Sự cố

```json
{
  "vehicleId": "<ObjectId>",
  "bookingId": "<ObjectId-khong-bat-buoc>",
  "description": "Mô tả hiện trạng ít nhất 10 ký tự",
  "severity": "medium",
  "photoKeys": [],
  "requestId": "<UUID-client-giu-nguyen-khi-thu-lai>"
}
```

Severity nhận low/medium/high. Nếu gắn booking thì booking phải thuộc xe. Nhân viên, case number, trạng thái và thời điểm do server cấp. Lặp requestId cùng nội dung trả bản ghi cũ; dùng lại cho nội dung khác trả 409. Ghi case và audit cùng transaction. Workspace hiển thị đúng trạng thái xử lý hiện có thay vì cố định nhãn “đã gửi”.

### Ảnh

#### Lưu ảnh dùng chung với Cloudinary

Chạy `npm install` trong `BE`, sau đó điền `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` vào `BE/.env` và khởi động lại backend. Khi đủ cả ba biến, ảnh Garage được upload lên Cloudinary với loại `authenticated`. Nếu chỉ điền một phần, backend báo lỗi cấu hình; nếu để trống cả ba, backend dùng thư mục local như bên dưới. `.env.example` chỉ chứa giá trị mẫu, không điền secret thật vào file này.

Các thành viên cần dùng cùng Cloudinary product environment và database để xem cùng ảnh và biên bản. API vẫn trả key `garage-photos/<userId>/<uuid>.<extension>`; backend kiểm tra JWT rồi tải ảnh bằng URL ký có hạn và trả bytes cho FE. Không cần thay đổi frontend hoặc tạo unsigned upload preset. Không tự chuyển ảnh local cũ lên Cloudinary: cần upload lại các ảnh đó qua ứng dụng. Các bài test truyền thư mục tạm vẫn dùng local, không upload ảnh test lên cloud.

#### Lưu local

Upload từng ảnh bằng `{ name, contentType, data }`, trong đó data là base64 thuần không có tiền tố data URL. Nhận JPG/PNG/WebP, tối đa 500 KB mỗi ảnh; kiểm tra chữ ký tệp, kích thước và định dạng. Các validator biên bản giới hạn tối đa 4 photoKeys. FE upload trước, đính kèm key vào báo cáo và tải ảnh qua fetch có JWT; object URL được thu hồi khi đóng ảnh.

Mặc định tệp nằm trong `BE/storage/garage-photos/` và đã được gitignore. Có thể cấu hình `GARAGE_UPLOAD_DIRECTORY` tới thư mục lưu trữ của backend. Khóa và đường dẫn bị giới hạn chặt; không nhận traversal, SVG/HTML hoặc đường dẫn tùy ý. Ảnh không có public URL; nhân viên có quyền Garage được đọc ảnh trong phạm vi dữ liệu dùng chung. Phản hồi ảnh dùng `private, no-store`. Ảnh demo cũ chỉ có key mà chưa có tệp sẽ hiện thông báo chưa tải được ảnh.

## Trạng thái giao diện và lịch sử

- Giao diện có loading, lỗi và tải lại; không thay bằng dữ liệu giả khi API lỗi.
- Chỉ đóng dialog và báo thành công sau khi backend lưu/gửi xong. Nếu gửi bước cuối lỗi sau khi nháp đã được tạo, FE giữ recordId/version để thử lại mà không tạo nháp mới. Lỗi version hướng dẫn đóng biên bản và tải lại dữ liệu.
- Kiểm định chuyển `revision/reject` trên FE thành `requires_repair/fail` trên API; trạng thái BE `pending` được hiển thị là chờ duyệt.
- Lịch sử lấy các audit gửi/xác nhận/sự cố của nhân viên, cộng mốc cập nhật nháp gần nhất. Chưa lưu từng lần sửa nháp thành một audit riêng.
- Công việc kiểm định/tiếp nhận chưa có lịch hẹn thực được hiển thị “Chưa có lịch hẹn”; ngày tạo không được trình bày như lịch hẹn. Lịch bàn giao/nhận trả lấy từ booking, hiển thị theo UTC+7.

## Chạy và kiểm thử

Chạy `npm run db:setup` để bổ sung index, sau đó `npm run dev`. Giữ `MONGODB_URI`/`MONGODB_DB_NAME` của môi trường hiện có. Đọc và lưu nháp hoạt động với standalone; gửi đề xuất, xác nhận giao nhận và tạo sự cố cần MongoDB replica set hoặc Atlas. Standalone trả 503 thay vì ghi dở dang. Ví dụ URI cho replica set đã được khởi tạo:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
```

Chạy `node --test` trong BE và `node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand` trong FE. Test backend tạo database và thư mục ảnh tạm riêng; kiểm tra permission, optimistic concurrency, điều kiện bàn giao, đối chiếu nhận trả, retry, rollback và ảnh riêng tư.

## Phần phối hợp sau

Luồng duyệt biên bản kiểm định của Manager được giữ cho bước sau. Garage chỉ gửi sang pending và hiển thị blockers ở tiếp nhận khi chưa được duyệt. Phân công theo chi nhánh, trả xe cho chủ xe, kiểm định định kỳ, xuất PDF và xử lý tài chính không nằm trong các luồng giao diện Garage vừa nối này.
