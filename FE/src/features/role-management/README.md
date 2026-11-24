# Quản lý vai trò và quyền

Màn quản lý vai trò và quyền theo cấu trúc feature của `FE/src/features`:

- `pages/` ghép màn hình.
- `components/` chứa các phần giao diện và điều khiển dùng lại.
- `hooks/` quản lý state và thao tác.
- `accessControlConfig.js` chứa danh mục quyền và điều hướng Admin.
- `features/management/` cung cấp API client và bảng quản lý tài nguyên dùng chung cho Admin/Manager.
- `utils/` chứa tiện ích xuất CSV.
- `styles/` chứa style của feature.

Backend dùng session đăng nhập, kiểm tra vai trò và quyền ở các endpoint management. Danh sách tài khoản, vai trò, hồ sơ xe/tài xế, giá, chính sách, báo cáo và nhật ký được đọc từ MongoDB. Thao tác ghi cập nhật nguồn dữ liệu và tạo audit event.

Admin phụ trách tài khoản, vai trò/quyền và nhật ký. Hồ sơ xe/tài xế, phê duyệt, bảng giá, chính sách, khuyến mãi và báo cáo thuộc workspace Manager; API từ chối truy cập chéo theo actor.
