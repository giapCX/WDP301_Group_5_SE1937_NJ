# Manager dashboard

Dashboard Manager tập trung vào booking, thanh toán đã ghi nhận, hoàn tiền và cấu hình dịch vụ. Ngoại lệ hủy, phương án sự cố, hoàn tiền và bảo dưỡng ảnh hưởng an toàn có hàng đợi phê duyệt riêng. Theo dõi số lượng xe và giấy phép tài xế không thuộc màn hình Manager.

Admin quản lý tài khoản, vai trò, quyền và nhật ký trong `/admin/roles-permissions`. Admin không duyệt booking, hoàn tiền, sự cố hay bảo dưỡng; các quyết định nghiệp vụ nằm trong phân hệ Manager, Operator hoặc Gara theo quyền đã thiết kế.

Backend yêu cầu session active có vai trò `manager` cho dashboard và hàng đợi quyết định. Báo cáo lấy từ `bookings`, `payments` và `refunds`; cấu hình dịch vụ dùng các API quản trị có kiểm tra vai trò và quyền phía máy chủ.
