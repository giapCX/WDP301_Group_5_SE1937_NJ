# Luồng ký hợp đồng hiện tại

## Quản lý xe: Owner và Manager

1. Owner đăng ký xe, tải hồ sơ và xác nhận thông tin. Hệ thống tạo hợp đồng `draft` **chưa có chữ ký**, không tự ký thay Owner hoặc nền tảng.
2. Operation sàng lọc hồ sơ và phân công lịch. Garage kiểm định và gửi báo cáo. Owner xác nhận hiện trạng, sau đó Manager duyệt theo biên bản đạt.
3. Manager mở **Hợp đồng → Lập nội dung và ký hợp đồng phía nền tảng**, hoặc truy cập `/#/contracts`. Chọn xe đã duyệt, nhập ngày bắt đầu/kết thúc, hoa hồng, đơn vị nhận ủy quyền, nơi lập và điểm tiếp nhận rồi **Lập / mở hợp đồng**. Mặc định thời hạn một năm, hoa hồng theo hợp đồng nháp (10% nếu tạo mới).
4. Hợp đồng ủy quyền hiển thị dạng văn bản A4, lấy thông tin từ hồ sơ xe, bản kiểm định đã duyệt và thông tin Manager nhập. Nội dung trình ký được lưu theo phiên bản và có thể in hoặc lưu PDF. Thao tác lập lại mở đúng bản đã trình ký.
5. Owner mở **Hợp đồng** trong không gian chủ xe, hoặc `/#/contracts`: đọc nội dung, nhập họ tên, tích đồng ý và ký bằng tài khoản của mình.
6. Manager mở cùng hợp đồng ở phạm vi **Nền tảng**, đọc và ký riêng phía XeDi. Hai bên có thể ký trước/sau nhau; Owner không được ký thay Manager, Operation không được ký phía nền tảng.
7. Chỉ khi đủ hai chữ ký mới `active`. Garage kiểm tra thời hạn, quyền giữ xe, biên bản kiểm định và trạng thái xe trước khi lập biên bản nhận xe. Owner xác nhận biên bản, Garage hoàn tất tiếp nhận, rồi Operation hoàn thiện và xuất bản tin nháp.

## Thuê xe: Renter và Manager

1. Booking cần ở `awaiting_payment` do luồng duyệt booking bên ngoài chức năng hợp đồng này cung cấp. Xe đã nhập gara, hợp đồng quản lý có hiệu lực và đủ quyền giữ xe/cho thuê; Renter có danh tính và GPLX hợp lệ tới hết chuyến.
2. Operation vào `/#/contracts`, chọn **Thuê xe**, chọn booking và **Lập / mở hợp đồng**. Manager cũng có quyền lập. Hệ thống chốt tiền thuê/cọc, giá/ngày, lịch, điểm nhận/trả và các bên từ booking; không nhập lại số tiền thủ công.
3. Renter đăng nhập, mở liên kết **Hợp đồng** trên trang chủ, chọn hợp đồng thuê của mình, đọc nội dung và xác nhận ký.
4. Manager ký riêng phía nền tảng. Operation chỉ lập và xem, không ký phía Manager. Đủ hai bên thì hợp đồng `signed`, có thời điểm hoàn tất.
5. Ký xong **không tự chuyển booking sang `confirmed`, không tạo giao dịch thanh toán**. Luồng thanh toán phải xác nhận đủ tiền thuê và cọc; Garage kiểm tra riêng trước giao xe.

Nếu booking có `payment_deadline_at`, quá thời điểm này không được lập/ký. Dự án chưa có đầy đủ API duyệt booking và tích hợp thanh toán; bên triển khai booking cần ghi hạn 15 phút tại thời điểm duyệt, không gia hạn bằng cách mở hợp đồng. Booking cũ thiếu hạn chỉ kiểm tra chưa bắt đầu; không coi đây là đã triển khai đầy đủ cơ chế giữ chỗ.

## Phạm vi triển khai và dữ liệu cũ

- Đây là xác nhận điện tử bằng tài khoản, họ tên và thao tác đồng ý; chưa có OTP, chứng thư số hoặc nhà cung cấp ký số. Màn hình ghi rõ giới hạn này.
- Nội dung đã trình ký gắn phiên bản và mã kiểm tra; chữ ký gửi kèm mã của bản người dùng đang đọc. Nếu không khớp, yêu cầu mở lại nội dung. Dữ liệu và thời gian ký dùng phía server.
- Chữ ký và audit ghi trong cùng transaction. Lỗi audit hủy chữ ký; ký đồng thời không ghi mất chữ ký bên kia; ký lặp bị chặn.
- Người dùng chỉ đọc/ký hợp đồng của mình. Manager không được ký phía nền tảng cho hợp đồng mà mình là chủ xe/khách thuê.
- Có thể **In / lưu PDF** từ hộp thoại hợp đồng. Đây là in nội dung đã lưu và chữ ký xác nhận, không phải bản PDF có chứng thư số.
- Giữ nguyên các hợp đồng seed/hợp đồng giấy đã ký trước đây; không tự chuyển đổi hoặc giả lập chữ ký mới. Hồ sơ cũ chưa có nội dung trình ký phải được Manager lập trước nếu còn chưa ký. Bản đã ký muốn sửa phải có quy trình phụ lục riêng; chức năng này không tự áp dụng các đề nghị phụ lục đang chờ.

## API

- `GET /api/contracts/{management|rental}?page=1&limit=10`: hợp đồng của người đăng nhập; thêm `view=staff` cho Manager/Operation.
- `GET /api/contracts/{type}/candidates`: danh sách xe/booking có thể chọn để lập, có phân trang.
- `POST /api/contracts/{type}/prepare/{vehicleId|bookingId}`: lập nội dung. Hợp đồng quản lý nhận tùy chọn `startDate`, `endDate`, `commissionRatePct`, `platformName`, `place`, `garage`.
- `GET /api/contracts/{type}/{id}`: nội dung và quyền ký hiện tại.
- `POST /api/contracts/{type}/{id}/sign`: `{ signatureName, acceptedTerms: true, documentHash }`. Thêm `view=staff` cho Manager ký phía nền tảng.
- Hai API Owner `/api/owner/agreements/{id}` và `/{id}/sign` dùng chung quy tắc mới, không còn lối ký bỏ qua điều kiện duyệt xe/nội dung.
