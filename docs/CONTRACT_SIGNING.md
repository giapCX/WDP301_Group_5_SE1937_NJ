# Luồng ký hợp đồng hiện tại

## Quản lý xe: Owner và Manager

1. Owner đăng ký xe, tải hồ sơ và xác nhận thông tin. Hệ thống tạo hợp đồng `draft` **chưa có chữ ký**, không tự ký thay Owner hoặc nền tảng.
2. Operation sàng lọc hồ sơ và phân công lịch. Garage kiểm định và gửi báo cáo. Owner xác nhận hiện trạng, sau đó Manager duyệt theo biên bản đạt.
3. Manager mở **Hợp đồng → Lập nội dung và ký hợp đồng phía nền tảng**, hoặc truy cập `/#/contracts`. Chọn xe đã duyệt, nhập ngày bắt đầu/kết thúc, hoa hồng, đơn vị nhận ủy quyền, nơi lập và điểm tiếp nhận rồi **Lập / mở hợp đồng**. Mặc định thời hạn một năm, hoa hồng theo hợp đồng nháp (10% nếu tạo mới).
4. Hợp đồng ủy quyền hiển thị dạng văn bản A4, lấy thông tin từ hồ sơ xe, bản kiểm định đã duyệt và thông tin Manager nhập. Nội dung trình ký được lưu theo phiên bản và có thể in hoặc lưu PDF. Thao tác lập lại mở đúng bản đã trình ký.
5. Owner mở **Hợp đồng** trong không gian chủ xe, hoặc `/#/contracts`: đọc nội dung, nhập họ tên, tích đồng ý và ký bằng tài khoản của mình.
6. Sau khi Owner ký, Operator mở hợp đồng ở phạm vi **Nền tảng**, rà soát hồ sơ và bấm **Xác nhận đã tiếp nhận**. Đây chỉ là xác nhận nhận hồ sơ/chuyển Manager, không phải duyệt nội dung pháp lý hay ký thay XeDi. Backend ghi Operator, thời điểm và audit trong cùng transaction.
7. Manager chỉ có thể ký phía XeDi sau khi có chữ ký Owner và Operator đã tiếp nhận. Chỉ khi đủ hai chữ ký mới `active`. Garage kiểm tra thời hạn, quyền giữ xe, biên bản kiểm định và trạng thái xe trước khi lập biên bản nhận xe. Owner xác nhận biên bản, Garage hoàn tất tiếp nhận, rồi Operation hoàn thiện và xuất bản tin nháp.

## Thuê xe: Renter và Manager

1. Booking mới chờ Operation duyệt tối đa 2 giờ. Khi duyệt, booking chuyển `awaiting_payment` với hạn giữ xe mới là 15 phút để ký và thanh toán. Xe đã nhập gara, hợp đồng quản lý có hiệu lực và đủ quyền giữ xe/cho thuê. Renter có danh tính và GPLX hợp lệ tới hết chuyến.
2. Operation vào `/#/contracts`, chọn **Thuê xe**, chọn booking và **Lập / mở hợp đồng**. Manager cũng có quyền lập. Hệ thống chốt tiền thuê/cọc, giá/ngày, lịch, điểm nhận/trả và các bên từ booking; không nhập lại số tiền thủ công.
3. Renter mở **Chuyến đi & thanh toán**, chọn chuyến rồi bấm **Xem hợp đồng thuê** để đọc và ký đúng bản đang trình ký. Hợp đồng thể hiện XeDi là bên cho thuê đại diện theo ủy quyền; người thuê là bên còn lại.
4. Operator rà soát và xác nhận tiếp nhận sau khi Renter ký. Manager chỉ ký riêng phía nền tảng sau xác nhận này. Operator không phê duyệt nội dung hoặc ký thay Manager. Đủ hai bên thì hợp đồng `signed`, có thời điểm hoàn tất.
5. Sau khi hai bên ký, Renter thanh toán tiền thuê và cọc. Môi trường local có thể bật `RENTER_DEMO_SERVICES=true` trong `BE/.env` để chạy thanh toán mô phỏng. Backend chỉ chuyển booking sang `confirmed` sau khi ghi nhận đủ hai khoản. Garage xác nhận giao và nhận trả xe. Renter xem hai biên bản trong chi tiết chuyến.

Hạn thanh toán được dùng chung khi tìm lịch trống, lập/ký hợp đồng và thanh toán. Mở hợp đồng không gia hạn giữ xe. Với booking cũ thiếu hạn thanh toán, hệ thống dùng hạn giữ xe đã lưu nếu có.

## Phạm vi triển khai và dữ liệu cũ

- Hộp thoại hợp đồng chỉ cho xem và in nội dung đã được Manager lập. Nếu hồ sơ chưa có `contract_document`, giao diện giải thích Manager cần lập nội dung; không hiển thị mẫu Word trống hoặc cho phép in/ký/tiếp nhận. Khi có nội dung điện tử, bản A4 đã điền dữ liệu là nội dung chính để rà soát và in; file Word gốc chỉ còn là tài liệu tham khảo tùy chọn.
- Đây là xác nhận điện tử bằng tài khoản, họ tên và thao tác đồng ý; chưa có OTP, chứng thư số hoặc nhà cung cấp ký số. Màn hình ghi rõ giới hạn này.
- Nội dung đã trình ký gắn phiên bản và mã kiểm tra; chữ ký gửi kèm mã của bản người dùng đang đọc. Nếu không khớp, yêu cầu mở lại nội dung. Dữ liệu và thời gian ký dùng phía server.
- Chữ ký và audit ghi trong cùng transaction. Lỗi audit hủy chữ ký; ký đồng thời không ghi mất chữ ký bên kia; ký lặp bị chặn.
- Người dùng chỉ đọc/ký hợp đồng của mình. Operator chỉ tiếp nhận hợp đồng đã có chữ ký của Owner/Renter; không thể ký nền tảng. Manager không được ký phía nền tảng cho hợp đồng mà mình là chủ xe/khách thuê.
- Có thể **In / lưu PDF** từ hộp thoại hợp đồng. Đây là in nội dung đã lưu và chữ ký xác nhận, không phải bản PDF có chứng thư số.
- Giữ nguyên các hợp đồng seed/hợp đồng giấy đã ký trước đây; không tự chuyển đổi hoặc giả lập chữ ký mới. Hồ sơ cũ chưa có nội dung trình ký phải được Manager lập trước nếu còn chưa ký. Bản đã ký muốn sửa phải có quy trình phụ lục riêng; chức năng này không tự áp dụng các đề nghị phụ lục đang chờ.
- Luồng OTP ký thuê cũ chỉ còn áp dụng cho hồ sơ lịch sử không có tài liệu trình ký theo mẫu điện tử. Hợp đồng mới theo hai mẫu chuẩn phải đi qua bước Operator tiếp nhận trước chữ ký phía XeDi.

## API

- `GET /api/contracts/{management|rental}?page=1&limit=10&q=<contract-code>`: hợp đồng của người đăng nhập; thêm `view=staff` cho Manager/Operation. `q` chỉ khớp chính xác toàn bộ mã hợp đồng (`agreement_number` hoặc `contract_number`, không phân biệt hoa thường), không tìm theo booking hoặc biển số.
- `GET /api/contracts/{type}/candidates`: danh sách xe/booking có thể chọn để lập, có phân trang.
- `POST /api/contracts/{type}/prepare/{vehicleId|bookingId}`: lập nội dung. Hợp đồng quản lý nhận tùy chọn `startDate`, `endDate`, `commissionRatePct`, `platformName`, `place`, `garage`.
- `GET /api/contracts/{type}/{id}`: nội dung, `canSign`, `canOperatorConfirm` và `operatorIntakeConfirmedAt` theo quyền/trạng thái hiện tại.
- `POST /api/contracts/{type}/{id}/sign`: `{ signatureName, acceptedTerms: true, documentHash }`. Thêm `view=staff` cho Manager ký phía nền tảng.
- `POST /api/contracts/{type}/{id}/operator-intake?view=staff`: Operator có permission `operation.contract.intake.confirm` xác nhận đã nhận hồ sơ sau chữ ký Owner/Renter. Lệnh kiểm tra trạng thái, bản nội dung và điều kiện hợp đồng; ghi `operator_intake` cùng audit trong transaction. Lặp lại hoặc tiếp nhận trước chữ ký bên kia bị từ chối.
- Hai API Owner `/api/owner/agreements/{id}` và `/{id}/sign` dùng chung quy tắc mới, không còn lối ký bỏ qua điều kiện duyệt xe/nội dung.
