# Phân định nghiệp vụ Manager và Admin

## Admin — quản trị quyền truy cập

1. Đăng nhập và mở `/admin/roles-permissions`.
2. Xem tổng quan tài khoản và nhật ký quản trị.
3. Tạo, cập nhật, khóa hoặc mở khóa tài khoản nhân sự; gán vai trò phù hợp.
4. Cập nhật ma trận quyền cho các vai trò và kiểm tra lại nhật ký.

Admin quản lý danh tính và cấu hình quyền. Admin không duyệt booking, quyết định hoàn tiền, xử lý sự cố, bảo dưỡng hoặc cấu hình dịch vụ. API management giới hạn Admin ở tài khoản, vai trò và nhật ký.

## Manager — quyết định vận hành và dịch vụ

1. Mở `/manager/dashboard` hoặc `/manager/revenue` để xem booking, khoản đã thu và hoàn tiền đã xử lý theo kỳ.
2. Dùng bảng giá, chính sách và khuyến mãi để quản lý cấu hình dịch vụ.
3. Mở `/manager/operation-approvals` để xử lý ngoại lệ hủy vượt số tiền đã thu, phương án sự cố và phiếu hoàn tiền.
4. Mở `/manager/maintenance-approvals` để duyệt hoặc trả Gara phiếu bảo dưỡng có ảnh hưởng an toàn sau khi kiểm tra lại đạt.
5. Dùng nhật ký để tra cứu các thay đổi nghiệp vụ.

Manager không nhận booking mới thay Operator và không thực hiện thay đổi phân công thay Operator/Gara. Quyết định duyệt chỉ cho phép bước tiếp theo trong workflow; hệ thống vẫn kiểm tra trạng thái booking, thanh toán, kiểm tra Gara và phiên bản yêu cầu trước khi ghi nhận.

## Các actor phối hợp

| Actor | Trách nhiệm trong luồng |
| --- | --- |
| Renter | Gửi booking, yêu cầu hủy/đổi lịch, xem khoản thu và trạng thái hoàn tiền, báo sự cố |
| Operator | Tiếp nhận và báo giá booking, điều phối, xử lý phụ phí, trình phương án sự cố và cập nhật kết quả |
| Driver | Nhận chuyến, cập nhật tiến độ và báo sự cố theo chuyến |
| Gara | Nhận xe, sửa chữa, kiểm tra lại và gửi Manager duyệt khi ảnh hưởng an toàn |
| Manager | Duyệt ngoại lệ vận hành, hoàn tiền mô phỏng và bảo dưỡng ảnh hưởng an toàn; quản lý giá/chính sách/khuyến mãi |
| Admin | Quản lý tài khoản, vai trò, quyền truy cập và nhật ký quản trị |

Manager dashboard chỉ tổng hợp booking, thanh toán và hoàn tiền. Màn hình Manager không theo dõi số lượng/trạng thái xe hoặc giấy phép tài xế.
