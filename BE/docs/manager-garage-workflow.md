# Luồng phối hợp Garage, Manager và xác minh sự cố

## Kiểm định đầu vào

1. Garage tạo/sửa nháp ở `/api/garage/inspections`, đính kèm ảnh và gửi bằng `POST /api/garage/inspections/:id/submit` với `version` hiện tại. Biên bản chuyển `draft → pending`; Garage chưa phê duyệt xe.
2. Manager mở mục kiểm duyệt xe. `GET /api/manager/vehicles?status=pending` trả cả xe `submitted`, `pending_review`, `revision_required`. Với mỗi xe, backend chọn **vòng onboarding mới nhất theo `created_at`, `_id`**, không dùng biên bản periodic/return hoặc tìm một bản đạt cũ để bỏ qua vòng mới.
3. Kết quả có `inspection.id`, `version`, `staffId`, `status`, `recommendation`, `conditionReport`, `decisionReason`, `inspectedAt`. Manager đọc checklist, số km, nhiên liệu và mở ảnh lớn trước khi quyết định.
4. Gọi `PATCH /api/manager/vehicles/:id/review`:

```json
{
  "action": "approve",
  "note": "Đã đối chiếu hồ sơ và báo cáo Garage",
  "inspectionId": "<ObjectId-biên-bản-đang-xem>",
  "inspectionVersion": 1
}
```

| Quyết định | Biên bản đang pending | Trạng thái xe |
| --- | --- | --- |
| `approve` | `approved` | `approved` |
| `revision` | `revision_required` | `revision_required` |
| `reject` | `rejected` | `rejected` |

Một transaction cập nhật biên bản, xe và audit; sai một bước sẽ rollback. Lý do bổ sung/từ chối tối thiểu 5 ký tự. Chỉ duyệt khi báo cáo đã gửi và đề xuất `pass`; không có biên bản, biên bản nháp, không đạt hoặc version cũ đều bị chặn. Quyết định không thay đổi quyền giữ xe: xe vẫn ở chủ xe cho tới khi Garage xác nhận nhập gara.

Hồ sơ cũ có biên bản onboarding đã `approved/pass` vẫn có thể dùng khi xét duyệt xe ban đầu; backend không viết lại quyết định cũ. Nếu có vòng mới thì phải xử lý vòng mới. Khi chưa có biên bản, Manager chỉ được yêu cầu bổ sung/từ chối hồ sơ, không phê duyệt xe. Nếu có biên bản thì phải gửi đúng ID/version đang xem. `409` yêu cầu tải lại; không tự gửi lại quyết định với ID/version mới khi người dùng chưa xem báo cáo mới.

## Kiểm định lại và tiếp nhận

- Sau `revision`, biên bản cũ được giữ nguyên lịch sử và lý do Manager hiển thị cho Garage. Do vòng cũ không còn `pending`, Garage tạo và gửi vòng mới được. Xe `revision_required` vẫn xuất hiện trong hàng đợi Manager.
- Sau `approve`, Garage tiếp nhận theo API intake hiện có. Backend vẫn yêu cầu xe được duyệt, vòng onboarding mới nhất `approved/pass`, hợp đồng quản lý hợp lệ và quyền giữ xe. Xác nhận tiếp nhận mới chuyển `physical_status` thành `at_garage`.
- Hai quyết định đồng thời hoặc quyết định dựa trên báo cáo cũ không thể cùng thành công. Không tự duyệt biên bản mới nếu nó khác bản Manager đã xem.

## Ảnh nghiệp vụ

Garage tiếp tục upload qua `POST /api/garage/photos`. Manager được **đọc** ảnh qua `GET /api/garage/photos/:owner/:name`, không được dùng quyền Manager để upload. Operation có role `OPERATION_STAFF` và permission `incident.review` được đọc ảnh phục vụ điều tra. Renter/Owner không có quyền Garage không được đọc kho ảnh nghiệp vụ bằng API này.

Frontend dùng fetch có JWT và blob như trước; không công khai ảnh Cloudinary. Các API đọc này theo phạm vi kho nghiệp vụ dùng chung hiện tại, chưa tách quyền theo chi nhánh/phân công.

## Sự cố và đề xuất bồi thường

Chuỗi xử lý: **Garage ghi nhận → Operation điều tra/đề xuất → Manager quyết định**. Báo cáo Garage chỉ lưu hiện trạng/chứng cứ; không tự tạo nghĩa vụ bồi thường, không tự trừ cọc. Xe có hư hỏng mới lúc nhận trả vẫn được đặt `maintenance`.

Đăng nhập Operation và mở `/#/operations` để xem sự cố, ảnh Garage, nhập căn cứ/chi phí và trạng thái phản hồi thực tế của khách. Đây là màn xử lý sự cố, không phải toàn bộ workspace Operation về booking, listing hoặc thanh toán.

API Operation:

- `GET /api/operations/incidents`: hàng đợi sự cố đang mở.
- `POST /api/operations/incidents/:id/compensation-proposal`:

```json
{
  "amount": 800000,
  "evidenceBasis": "Đối chiếu ảnh trước/sau và báo giá sửa chữa số ...",
  "renterResponse": "disputed"
}
```

`renterResponse`: `agreed`, `disputed`, `not_received`; không tự chọn đồng ý khi khách chưa trả lời. Nếu điều tra yêu cầu có sẵn của Owner, gửi thêm `claimIndex` đúng vị trí yêu cầu đang pending. Operation bổ sung căn cứ và mức đề xuất vào yêu cầu đó, không nhân đôi. Số đề xuất không vượt số yêu cầu. Đã gửi Manager thì không được sửa âm thầm. Đề xuất mới và audit được ghi trong transaction, chưa khấu trừ cọc.

Endpoint này chỉ cho Operation có permission hiện tại `incident.review`; Manager và Garage không được tự tạo rồi tự duyệt đề xuất. Phải xác định booking đúng xe trước khi đề xuất trừ cọc renter. Sự cố lúc gara giữ xe, không gắn booking, vẫn được báo cáo/theo dõi nhưng chưa thuộc luồng khấu trừ cọc khách này.

Manager gọi `PATCH /api/manager/incidents/:id/compensation`:

```json
{
  "decision": "approve",
  "amount": 800000,
  "claimIndex": 0,
  "note": "Kết luận sau khi xem chứng cứ và phản hồi hai bên"
}
```

`claimIndex` bắt buộc để tránh quyết định nhầm yêu cầu sau khi hồ sơ thay đổi. Chỉ duyệt tiền khi đã có căn cứ từ Operation, không vượt số đề xuất/yêu cầu và cọc còn đủ. Từ chối cũng phải có lý do. Nhãn `pending` hiển thị đúng các nút xử lý, không bị hiểu nhầm là đã quyết định.

Transaction bao gồm ledger cọc, quyết định sự cố và audit. Không còn cách ghi cọc trước rồi cố hoàn tác thủ công nếu ghi sự cố lỗi. Quyết định lặp/đồng thời không trừ hai lần; ledger lưu `incident_case_id` và `claim_index`, đồng thời bảo vệ quyết định cũ chưa có `claim_index`. Khi hết yêu cầu chờ, hồ sơ được kết luận; Garage tải lại workspace sẽ thấy trạng thái mới.

`PATCH /api/manager/incidents/:id/review` với `{ "action": "resolve", "note": "..." }` chỉ đóng hồ sơ không còn yêu cầu chờ. Đóng sự cố hoặc giải quyết bồi thường **không tự chuyển xe ra khỏi maintenance**. Phải có nghiệp vụ sửa chữa/kiểm tra an toàn riêng.

## Giới hạn và dữ liệu cũ

- Đây là quyết định/ledger nội bộ; chưa gọi nhà cung cấp thanh toán để tự chuyển tiền hoặc hoàn tiền.
- Màn Operation ghi phản hồi mà nhân viên đã thu thập, chưa thay cho portal renter phản hồi hoặc cơ chế gửi thông báo 48 giờ. `not_received` được lưu rõ, không được trình bày như đồng ý; Manager phải nêu căn cứ quyết định.
- Chưa xử lý tự động khoản vượt cọc, payout bồi thường cho Owner hoặc trách nhiệm tài chính không gắn booking; hệ thống chặn khấu trừ và để hồ sơ được tiếp tục xử lý, không tự gán renter chịu tiền.
- Không chạy migration sửa hợp đồng, biên bản đã quyết định hoặc dữ liệu cũ có trạng thái lệch. Nếu phát hiện xe đã approved nhưng vòng mới còn pending/draft do dữ liệu chỉnh tay trước đây, cần rà soát riêng thay vì tự quyết định thay Manager.

## Kiểm thử

`BE/test/manager-garage-workflow.test.js` chạy với replica set/database tạm. Bao gồm: submit → review → intake; revision → vòng mới; reject đồng bộ; chống duyệt nháp/phiên bản cũ; xem ảnh theo quyền; cạnh tranh đồng thời; báo sự cố → đề xuất Operation → quyết định Manager; rollback khi audit lỗi. Test không sửa database ứng dụng.
