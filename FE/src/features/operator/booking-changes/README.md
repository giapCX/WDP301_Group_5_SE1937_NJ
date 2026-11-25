# Booking Modification

Route: `/operator/booking-change-requests`. Sidebar có liên kết Thay đổi lịch trình.

- `api/changeRequestApi.js`: gọi GET danh sách/chi tiết và PATCH duyệt/từ chối.
- `hooks/useChangeRequests.js`: lọc trạng thái, booking_id và phân trang 10 bản ghi trên server.
- `hooks/useChangeRequestDetail.js`: tải chi tiết, gửi quyết định, thông báo lỗi 401/409 và tải lại dữ liệu.
- `components/ChangeRequestTable.jsx`: bảng danh sách và trạng thái loading/lỗi/rỗng.
- `components/ItineraryComparison.jsx`: so sánh snapshot trước/sau, tô màu nội dung thay đổi.
- `components/ChangeRequestDetail.jsx`: thông tin người yêu cầu/xử lý, lý do, chi phí đề xuất và xác nhận quyết định.
- `components/ChangeStatus.jsx`, `changeConstants.js`: nhãn trạng thái yêu cầu riêng (approved khác confirmed của booking).
- `pages/BookingModificationPage.jsx`: ghép màn hình, bộ lọc, phân trang và thông báo thành công.
- `styles/bookingChanges.css`: CSS riêng; dùng chung sidebar, icon, format và CSS nền từ feature bookings.

Không tạo dữ liệu giả nếu API lỗi. Chênh lệch giá là đề xuất, chưa ghi nhận thu thêm/hoàn tiền. Nút duyệt có bước xác nhận; từ chối bắt buộc lý do tối đa 2000 ký tự. Khi 409, khóa thao tác đến khi người dùng tải lại chi tiết. Không bypass auth; PATCH cần Operator đã xác thực, nếu chưa tích hợp đăng nhập sẽ hiển thị lỗi 401.

Kiểm tra: npm run build từ FE. Trên trình duyệt đã kiểm tra tải 3 yêu cầu thật, chọn chi tiết, so sánh giờ/điểm dừng/giá và nút từ chối bị khóa khi chưa nhập lý do. Không thực hiện quyết định lên dữ liệu mẫu qua UI.
