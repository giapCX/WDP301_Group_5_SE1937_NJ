# Nghiệp vụ Operator Staff

Tài liệu mô tả quyền và API Operator Staff tại `#/operator`. Backend kiểm tra permission và trạng thái đối tượng; việc ẩn nút trên FE không thay thế kiểm tra này. Các thao tác ghi trạng thái, lịch kiểm định, hồ sơ sự cố, chứng cứ và audit cần MongoDB replica set hoặc Atlas để commit đồng bộ.

## Quyền theo màn hình

| Màn hình / thao tác | Permission |
| --- | --- |
| Tổng quan | `operation.dashboard.read` |
| Hợp đồng xe | `operation.contract.read` |
| Tiếp nhận hợp đồng đã có chữ ký Owner/Renter để chuyển Manager | `operation.contract.intake.confirm` |
| Xem hồ sơ xe/tài liệu | `operation.vehicle.read` |
| Cập nhật trạng thái xe | `operation.vehicle.status.update` |
| Lên lịch/đổi lịch kiểm định | `operation.vehicle.inspection.schedule` |
| Xem hồ sơ sự cố | `operation.incident.read` |
| Ghi nhận sự cố | `operation.incident.create` |
| Cập nhật hồ sơ khi được phép | `operation.incident.update` |
| Đính kèm biên bản | `operation.incident.evidence.attach` |
| Gửi hoặc gửi lại cho Manager | `operation.incident.submit` |

Permission được hợp nhất từ các role đang gán cho tài khoản. Admin giữ quyền truy cập hiện có; Manager không được cấp quyền Operator chỉ vì có role Manager. Quyết định duyệt xe/booking, kết luận pháp lý, bồi thường và trừ/hoàn cọc vẫn nằm ngoài quyền Operator.

Operator được xem danh sách và nội dung hợp đồng khi có `operation.contract.read`; quyền này độc lập với `operation.contract.intake.confirm`. Database đã có từ trước cần cập nhật role theo migration `db:migrate:operator-staff` nếu chưa nhận được quyền đọc mới.

## Tiếp nhận hợp đồng xe

Hệ thống dùng hai mẫu hợp đồng riêng: hợp đồng quản lý/ủy quyền giữa Chủ xe và XeDi; hợp đồng thuê giữa XeDi (đại diện theo ủy quyền) và Người thuê. Operator không ký hoặc duyệt thay Manager.

- Owner ký hợp đồng quản lý hoặc Renter ký hợp đồng thuê trước.
- Operator xem nội dung đã ký và xác nhận đã tiếp nhận để chuyển Manager. Backend chỉ cho phép thao tác khi hợp đồng còn `pending_signatures`, bản nội dung có mã hash, chữ ký Owner/Renter đã có và điều kiện nghiệp vụ của hợp đồng vẫn còn hợp lệ.
- Manager chỉ ký phía XeDi sau khi Operator tiếp nhận. Quy tắc này được kiểm tra trong backend, không dựa vào trạng thái nút trên giao diện.
- Xác nhận tiếp nhận ghi `operator_intake.confirmed_by_operator_id`, `operator_intake.confirmed_at` và audit trong cùng transaction. Chỉ có một lần tiếp nhận; thao tác lặp hoặc hồ sơ đã đổi bị từ chối.
- Hồ sơ Owner/Renter chính là các hợp đồng tiêu chuẩn đã trình ký; Operator không tạo chữ ký, thay nội dung, quyết định pháp lý hay cập nhật trạng thái booking/xe bằng thao tác tiếp nhận.

`GET /api/contracts/{management|rental}?view=staff` và `GET /api/contracts/{management|rental}/:id?view=staff` yêu cầu role `OPERATION_STAFF` cùng permission `operation.contract.read`. Tiếp nhận yêu cầu thêm permission riêng `operation.contract.intake.confirm`; thiếu quyền này không ngăn Operator xem hợp đồng.

Hai permission được thêm vào role seed và migration `db:migrate:operator-staff`. Với database hiện có, nếu chỉ cần cấp quyền hợp đồng và muốn giữ nguyên các permission khác, kiểm tra `BE/.env` rồi chạy `npm --prefix BE run db:grant:operator-contract-access` theo hướng dẫn tại README; đăng xuất và đăng nhập lại để nạp quyền mới. Không cần migration dữ liệu cho hai trường metadata tùy chọn.

## Tổng quan

`GET /api/operator/dashboard` trả về những metric phù hợp với permission của tài khoản: xe đang chạy, hợp đồng sắp hết hạn trong 30 ngày, sự cố đang xử lý/cần Operator/chờ Manager, hồ sơ xe chờ phân công, lịch kiểm định sắp đến/quá hạn và biên bản chờ Manager. Metric không có quyền được bỏ khỏi response.

## Trạng thái xe

`PATCH /api/operator/vehicles/:id/status` nhận:

```json
{ "status": "maintenance", "note": "Đưa xe đi bảo dưỡng theo ghi nhận của gara." }
```

`note` là lý do bắt buộc, dài 5–1.000 ký tự. Các chuyển trạng thái Operator được phép:

| Hiện tại | Trạng thái mới |
| --- | --- |
| `with_owner` | `maintenance` |
| `at_garage` | `maintenance` |
| `maintenance` | `at_garage`, chỉ khi hồ sơ xe đã được Manager duyệt |

Các chuyển giao `with_owner → at_garage`, `at_garage → rented`, trạng thái trả xe cho chủ và mọi trạng thái không nêu trên vẫn phải qua workflow hiện hữu của Garage/booking/withdrawal. Mỗi thay đổi dùng điều kiện trạng thái và `updated_at` để tránh ghi đè đồng thời, ghi `operational_status_history` và audit trong cùng transaction.

## Lịch kiểm định đầu vào

- `POST /api/operator/vehicles/:id/inspection-schedule` tạo lịch và một biên bản `draft`; nhận `garageStaffId`, `scheduledFor` (ISO 8601 trong tương lai) và `note`.
- Hồ sơ xe phải ở `submitted`, `pending_review` hoặc `revision_required`; xe phải ở `with_owner` hoặc `returned_to_owner`. Tài khoản được giao phải active, mang role `GARAGE_STAFF` và có permission hiệu lực `vehicle.inspect`.
- Unique partial index hiện có tiếp tục bảo đảm mỗi xe chỉ có một biên bản onboarding `draft`/`pending`.
- `PATCH /api/operator/vehicles/:id/inspection-schedule` đổi lịch hoặc người phụ trách khi biên bản vẫn là `draft`. Body giống POST và có thêm `version`; cập nhật tăng version để Garage không thể lưu đè bản cũ.
- Khi Garage gửi biên bản (`pending`), Operator chỉ theo dõi; không sửa kết quả, duyệt xe hoặc đổi lịch. Schema trạng thái hiện tại không có trạng thái hủy lịch nên không xóa biên bản để giả lập hủy.

`GET /api/operator/vehicles` và `GET /api/operator/vehicles/:id` trả biên bản onboarding mới nhất, kể cả vòng đã kết thúc, cùng trạng thái, lịch, Garage Staff phụ trách và version. `scheduleState` có thể là `scheduled`, `upcoming`, `overdue`, `awaiting_manager`, `unscheduled` hoặc `completed`.

## Hồ sơ sự cố

- Biểu mẫu Operator cho phép tìm và chọn xe liên quan; không còn trường chọn booking hoặc tọa độ.
- `POST /api/operator/incidents` nhận loại hồ sơ, mô tả và tùy chọn `incidentType`, `odometerKm`, `severity`. `PATCH /api/operator/incidents/:id` hỗ trợ cập nhật các trường này khi hồ sơ đang được Operator chỉnh sửa. Schema vẫn giữ booking/location cũ để tương thích hồ sơ hiện có và nghiệp vụ xử lý tiền cọc của Manager. Không có trường thời gian xảy ra riêng trong schema; API không giả lập trường đó từ thời gian tạo hồ sơ.
- Biên bản nhận PDF/JPEG/PNG/WebP, tối đa 4 MB mỗi tệp và 3 tệp mỗi hồ sơ. Tệp được kiểm tra loại/nội dung, lưu riêng tư và chỉ tải qua API có xác thực.
- Operator chỉ sửa, bổ sung chứng cứ hoặc gửi lại khi hồ sơ ở `reported` hoặc `need_more_information`. Khi gửi, trạng thái thành `pending_manager`; hồ sơ Manager đang xử lý, đã kết thúc hoặc đang chờ quyết định không thể bị Operator sửa.
- Manager có thể gọi `PATCH /api/manager/incidents/:id/review` với `{ "action": "request_information", "note": "..." }` khi hồ sơ đã được gửi và đang `pending_manager`. Ghi chú bắt buộc 5–1.000 ký tự; thao tác chuyển hồ sơ thành `need_more_information`, ghi timeline và audit. Operator cập nhật/gửi lại hồ sơ sẽ chuyển nó về `pending_manager`.
- `action: "resolve"` vẫn là quyết định riêng của Manager; không thể kết luận trong khi hồ sơ đang chờ Operator bổ sung.

## Kiểm tra

Các test nghiệp vụ liên quan: `BE/test/operator.test.js`, `BE/test/manager-garage-workflow.test.js` và `FE/src/features/operator/pages/OperatorPage.test.js`. Không có thay đổi schema hoặc migration cho các cập nhật này; không cần chạy migration database.
