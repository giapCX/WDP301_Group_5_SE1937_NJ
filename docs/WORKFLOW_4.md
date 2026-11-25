# Workflow 4 Quản lý booking và ngoại lệ

Tài liệu bàn giao cho người 4 trong mô hình công ty sở hữu xe và cung cấp tài xế. Phạm vi gồm tiếp nhận và báo giá, đổi lịch, phụ phí, hủy chuyến, hoàn tiền mô phỏng, sự cố, quyết định Manager và lịch sử xử lý. Cách tính giá hiện tại được giữ nguyên. Không có actor Owner.

## Phân chia trách nhiệm

| Phần | Module sử dụng | Giới hạn tích hợp |
|---|---|---|
| Tạo booking và thu tiền | renter-reservations, renter-payment.service | Dùng lại; chỉ thêm panel yêu cầu và tính đúng tiền còn lại khi có hoàn tiền/tranh chấp |
| Xác nhận và báo giá | bookings, booking-quote.service | Dùng lại bảng tính; kiểm tra xe đang bảo dưỡng và tài xế đủ điều kiện |
| Phân công và thực hiện | trip-workflow | Dùng lại API đổi xe/đổi tài xế/trạng thái; không viết hệ điều phối mới |
| Kiểm tra xe và ảnh Gara | garage, garage-damage.service | Dùng lại hồ sơ và đường dẫn ảnh có bảo vệ quyền |
| Bảng giá và chính sách | management | Chỉ thêm cửa sổ hủy miễn phí vào form chính sách đã có |
| Ngoại lệ người 4 | operations | Pages, components, hooks, api, styles; BE routes → controllers → services → repositories/models |

## Đường dẫn

- Operator: `/operator/bookings`, `/operator/booking-management`, `/operator/trip-monitoring`, `/operator/booking-change-requests`, `/operator/operations`.
- Trong `/operator/operations`: Phụ phí, Hủy chuyến, Sự cố, Theo dõi hoàn tiền; lọc booking và trạng thái, phân trang 10 hồ sơ.
- Link từ chi tiết booking mở `/operator/operations?booking=<id>`.
- Manager: `/manager/operation-approvals`, liên kết từ sidebar đang có; các tab Ngoại lệ hủy chuyến, Phê duyệt sự cố, Phê duyệt/hoàn tiền.
- Renter: `/renter/bookings`; chọn Chi tiết và yêu cầu trên một đơn để mở panel cùng tên. Panel hiển thị tối đa 20 hồ sơ gần nhất mỗi loại; lịch sử đổi lịch đầy đủ còn có API phân trang sẵn có.

## Các quy tắc nghiệp vụ

### Báo giá và xác nhận

Renter gửi yêu cầu, Operator kiểm tra dịch vụ, số khách, địa điểm, lịch trình và tính giá bằng bảng tính hiện có. Backend kiểm tra xe còn lịch, không có phiếu bảo dưỡng mở hoặc kết quả kiểm tra gần nhất không đạt. Khi gửi báo giá phải có ít nhất một tài xế đang hoạt động, hồ sơ được duyệt, giấy phép còn hạn và không trùng chuyến/lịch nghỉ. Đây là kiểm tra khả năng phục vụ, chưa gán tài xế; người 2 vẫn phụ trách phân công thực tế. Thiếu tài nguyên trả 409 để Operator trao đổi phương án/lịch khác; từ chối phải có lý do. Đơn đang chờ hủy không được gửi/chấp nhận báo giá, mở thanh toán mới hay phân công.

### Đổi lịch

Dùng lại booking_change_requests và màn so sánh trước/sau. Snapshot bổ sung destination, return_pickup_location, return_pickup_time và arrival_at/departure_at của mỗi điểm. Renter không gửi giá. Với đơn báo giá đã chấp nhận, giá ban đầu giữ nguyên trong đề xuất; Operator có thể gửi giá mới trước ưu đãi kèm lý do. Một phiên bản giá mới có mã riêng và cần Renter chấp nhận đúng mã trước khi Operator duyệt. Nếu giữ nguyên giá, Operator có thể duyệt sau khi kiểm tra khả năng đáp ứng.

Khi duyệt kiểm tra lại snapshot, thời gian, xe và tài xế; cập nhật booking, điểm dừng, thông tin đón về trên TripWorkflow và quyết định trong cùng transaction. Tổng báo giá mới giữ tỷ lệ giảm giá đã áp dụng; phần trả thừa được lập yêu cầu hoàn tiền, không tự đánh dấu đã hoàn.

Trong chuyến chỉ nhận đổi lịch sau khi Driver đã chuyển trạng thái routed_to_booking_changes. Không sửa điểm/giờ đón đã thực hiện, điểm tham quan đã hoàn thành hay lượt đón về đã bắt đầu. Giờ kết thúc mới phải ở tương lai. Luồng Driver được khôi phục sau quyết định. Việc hủy và đổi lịch đồng thời được kiểm tra trạng thái và tuần tự hóa qua transaction/khóa lịch xe.

### Phụ phí và tranh chấp

Tận dụng toàn bộ API additional-charge.service: nháp → xác nhận → tranh chấp → giữ/miễn; hoặc hủy nháp/khoản đã xác nhận. Các loại hiện tại gồm quá giờ, vượt km, chờ khách, khác. Thành tiền do backend tính từ số lượng × đơn giá; có mô tả, bằng chứng HTTPS và lịch sử snapshot. Khoản nháp/hủy không cộng tổng. Phụ phí đang tranh chấp tạm chặn thu tiền. Khi miễn/hủy khoản đã thu, phần trả thừa được lập yêu cầu hoàn tiền để Manager xét, tránh thất thoát hoặc tự hoàn lặp.

### Hủy chuyến

Renter hoặc Operator xem phí dự kiến rồi gửi yêu cầu hủy. Chỉ hủy trước khởi hành, khi xe chưa bàn giao. Operator duyệt/từ chối có lý do; duyệt mới chuyển booking thành cancelled, hủy phiên checkout, hủy yêu cầu đổi lịch đang chờ, hủy phân công và giải phóng lịch. Không tự đưa xe đang bảo dưỡng thành available. Tài xế chỉ trở lại available nếu không còn phân công hoạt động khác.

Đơn pending/quoted/awaiting_payment chưa thu tiền có phí 0. Các đơn khác cần một service_policies đang active. Dùng chính sách active cập nhật gần nhất và chụp lại tại thời điểm khách yêu cầu:

- Nếu free_cancellation_hours > 0 và yêu cầu được gửi sớm hơn hoặc bằng ngưỡng đó: phí 0.
- Nếu ngưỡng bằng 0 hoặc không có: không áp dụng cửa sổ miễn phí.
- Ngoài cửa sổ miễn phí: phí = làm tròn tổng báo giá sau ưu đãi × cancellation_fee_percent / 100.
- Dự kiến hoàn = max(0, tiền đã thu − tiền đã hoàn − phí hủy).
- Số tiền đã thu phải khớp payments đã paid; dữ liệu cũ thiếu paid_total được tính từ các giao dịch. Không khớp thì yêu cầu đối soát, không tự sửa số tiền.
- Nếu phí cao hơn tiền đã thu, Operator không tự miễn hoặc tạo khoản nợ. Manager xét ngoại lệ, nhập phí giữ lại hợp lệ và lý do trước khi hủy.
- Không cấu hình sẵn một tỷ lệ/cửa sổ chính sách mới trong dữ liệu người dùng. Manager dùng màn Policies hiện có để tạo và kích hoạt.

### Hoàn tiền mô phỏng

Dùng refunds gắn từng payment đã paid. Các yêu cầu pending/approved/completed đều giữ chỗ phần tiền có thể hoàn trên giao dịch. Không lập vượt tiền đã thu; dữ liệu không đủ sẽ rollback quyết định gây hoàn tiền. Chu trình pending → approved/rejected → completed; chỉ Manager có quyền duyệt và hoàn mô phỏng. complete chỉ áp dụng payment_method simulation/promotion và lưu mã SIM-REFUND-. Không gọi ngân hàng hoặc Stripe để chuyển tiền thật. Lặp yêu cầu đã xử lý trả 409.

paid_total vẫn là tổng tiền từng thu; refunded_total ghi tiền đã hoàn. compensation_refunded theo dõi riêng hoàn bồi thường để khoản đó không bị tính thu lại ở quyết toán. Giảm giá chuyến hoặc miễn phụ phí và bồi thường là các nguồn hoàn khác nhau, cùng dùng cơ chế giữ chỗ tiền hoàn.

### Sự cố và phê duyệt

Dùng incidents hiện có nên nhận được cả dữ liệu Driver và Gara. Renter/Operator có form mô tả, loại và URL bằng chứng; ảnh hư hỏng Gara dùng lại API bảo vệ quyền đang có. Operator ghi phương án hỗ trợ, bồi thường, đổi xe, đổi tài xế hoặc thay đổi lịch. Phương án có mã phiên bản và Manager duyệt/từ chối kèm lý do. Bồi thường được duyệt tạo yêu cầu hoàn từ giao dịch thật đã ghi nhận, rồi duyệt/hoàn theo quy trình riêng.

Sự cố thông thường có thể ghi kết quả và đóng. Tai nạn, khiếu nại hoặc hồ sơ có đề xuất phải có phê duyệt hợp lệ trước khi đóng. Đổi xe và đổi lịch tiếp tục sử dụng module người 2; không đóng sự cố nếu điều kiện xử lý thực tế chưa đáp ứng. Khi còn sự cố mở khác, không khôi phục sớm trạng thái chuyến. Các quyết định và thông báo được lưu trong booking.operation_events và history của hồ sơ, hiển thị khi các bên mở/cập nhật màn liên quan. Không gửi email/SMS hay triển khai push/GPS trong workflow này.

## Dữ liệu

Không thêm collection nghiệp vụ mới. Mở rộng:

| Collection | Nội dung |
|---|---|
| bookings | cancellation hiện hành, operation_events, refunded_total, compensation_refunded; dùng lại additional_charges và pricing_breakdown |
| booking_change_requests | Snapshot đầy đủ hai dịch vụ, price_offer có mã và accepted_at |
| refunds | booking_id, source_key, thời gian, người lập/duyệt, mã hoàn mô phỏng và history; giữ payment_id |
| incidents | kind, evidence, reported_at/resolved_at, resolution_approval có phiên bản, history |
| service_policies | free_cancellation_hours tùy chọn; giữ chính sách của người 5 |

Các field mới tùy chọn và có default khi hydrate qua Mongoose. Không xóa dữ liệu cũ và không chạy seed/migration trên database đang dùng. Mọi thao tác nhiều document cần MongoDB replica set/Atlas; không giả vờ transaction thành công trên standalone.

## API bổ sung

Các response dùng `{success:true,data:...}`. Operator chỉ dùng role operator active; Manager chỉ manager active; Renter chỉ truy cập booking của mình. user_id lấy từ phiên đăng nhập.

| Method | Path sau /api | Tác dụng |
|---|---|---|
| GET | /operator/operations/{cancellations,incidents,refunds} | Lọc page, booking_id, status |
| GET | /operator/operations/bookings/:id | Tổng hợp yêu cầu/lịch sử |
| GET | /operator/operations/bookings/:id/cancellation-preview | Phí theo chính sách |
| POST | /operator/operations/bookings/:id/cancellation | reason |
| POST | /operator/operations/bookings/:id/cancellation-decision | requestId, decision approve/reject, reason |
| POST | /operator/operations/bookings/:id/incidents | kind, description, evidence[] |
| POST | /operator/operations/incidents/:id/proposal | action, note, amount |
| POST | /operator/operations/incidents/:id/replace-driver | driver_id, reason; cần Manager duyệt phương án |
| POST | /operator/operations/incidents/:id/resolve | reason; dùng lại service điều phối |
| GET | /manager/operation-approvals/{cancellations,incidents,refunds} | Hàng đợi phê duyệt |
| POST | /manager/operation-approvals/bookings/:id/cancellation-decision | Như Operator, thêm feeOverride khi xét ngoại lệ |
| POST | /manager/operation-approvals/incidents/:id/decision | proposalId, decision, reason |
| POST | /manager/operation-approvals/refunds/:id/decision | decision approve/reject/complete, reason |
| GET | /renter/bookings/:id/operations | Yêu cầu, lịch sử, phụ phí, hoàn tiền và sự cố |
| GET/POST | /renter/bookings/:id/cancellation-preview hoặc cancellation | Xem phí / gửi reason |
| POST | /renter/bookings/:id/incidents | Báo cáo có bằng chứng |
| PATCH | /operator/booking-change-requests/:id/price | price nguyên VND trước ưu đãi, reason |
| POST | /renter/bookings/change-requests/:id/accept-price | offerId |

Giữ nguyên các API booking, additional-charges, change-requests, dispatch, Driver và Gara đã có.

## Kiểm thử

Chạy từ BE: `node --test tests/*.test.js`, với TEST_MONGO_URI trỏ replica set test. Mỗi integration test tạo database riêng có prefix test và xóa đúng database đó. Chạy từ FE: `npm run build`.

Checklist thủ công:

1. Renter gửi yêu cầu cả hai dịch vụ; Operator xem lịch, tính và gửi báo giá; khách chấp nhận và cọc mô phỏng.
2. Operator mở Phụ phí, lọc booking, tạo nháp, xem chi tiết, sửa, xác nhận; Renter khiếu nại; Operator giữ/miễn và kiểm tra tổng tiền.
3. Renter mở Chi tiết và yêu cầu, xem chính sách, gửi hủy; Operator duyệt/từ chối. Khi duyệt kiểm tra lịch xe, phân công và yêu cầu hoàn.
4. Manager mở Duyệt ngoại lệ/Hoàn tiền, duyệt rồi hoàn mô phỏng. Bấm lại không được tăng tiền đã hoàn.
5. Renter đổi lịch; Operator gửi giá mới; khách chấp nhận; Operator duyệt; đối chiếu giờ đón về và các điểm tour trên Driver.
6. Renter/Driver/Gara báo sự cố; Operator trình phương án; Manager duyệt/từ chối; Operator phối hợp điều phối và ghi kết quả. Sự cố vượt quyền không được đóng qua đường tắt cũ.
7. Thử không đăng nhập, sai vai trò, đọc/sửa booking người khác, sửa giá bằng payload, quyết định phiên bản cũ, vượt tiền hoàn và hai quyết định đồng thời.

Đặc tả Use Case và sơ đồ nằm trong WORKFLOW_4_SPEC.md.
