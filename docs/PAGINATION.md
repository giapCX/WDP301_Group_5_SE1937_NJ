# Phân trang danh sách

Các danh sách mặc định hiển thị 10 dòng/trang, có thể chọn 20 hoặc 50 dòng và chuyển tới trang đầu, trước, sau, cuối. Đổi bộ lọc hoặc số dòng sẽ về trang đầu; nếu xóa/duyệt hết bản ghi ở trang cuối, danh sách tự về trang còn dữ liệu.

- Manager/Admin: hồ sơ xe, sự cố, nhân sự, chính sách, hợp đồng, tài khoản, vai trò, nhật ký và các danh sách báo cáo.
- Garage: công việc kiểm định, tiếp nhận, bàn giao, sự cố và lịch sử; phân trang sau khi tìm kiếm/lọc.
- Owner: đội xe, hợp đồng, đối soát, yêu cầu rút xe và sự cố. Tổng quan vẫn hiển thị các bản ghi gần nhất.
- Operation: danh sách sự cố đang xử lý.
- Trang chủ: danh sách xe theo bộ lọc, tìm kiếm và sắp xếp.

Manager/Admin, Operation và danh sách xe trang chủ lấy từng trang từ API. Garage/Owner chia trang từ dữ liệu workspace đã tải; dữ liệu dùng cho thống kê và các ô chọn xe vẫn đầy đủ.

## API Manager/Admin và Operation

Ví dụ: `GET /api/manager/vehicles?status=all&page=2&limit=10`.

`page` là số nguyên dương, mặc định 1; `limit` mặc định 10, tối đa 100. API trả `data` theo cấu trúc hiện có và metadata `pagination` gồm `page`, `limit`, `total`, `totalPages` (kèm `pages` tương thích). `total` đếm sau khi lọc; trang vượt giới hạn được đưa về trang cuối. Kết quả cùng giá trị sắp xếp được phân định thêm bằng `_id`.

Các hàm Manager gọi nội bộ không truyền `page`/`limit` tiếp tục lấy đầy đủ dữ liệu để tạo báo cáo hoặc danh sách lựa chọn. API nhật ký vẫn mặc định 25 dòng khi không truyền tham số; Operation mặc định 10 dòng. Tổng tiền báo cáo tài chính luôn tính trên toàn bộ kỳ đã lọc, độc lập với trang đối soát đang xem. Xuất CSV nhật ký Admin xuất trang hiện tại; CSV Garage vẫn xuất toàn bộ kết quả sau lọc.
