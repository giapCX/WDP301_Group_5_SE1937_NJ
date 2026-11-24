# Quản lý vai trò và quyền

Màn quản lý vai trò và quyền theo cấu trúc feature của `FE/src/features`:

- `pages/` ghép màn hình.
- `components/` chứa các phần giao diện và điều khiển dùng lại.
- `hooks/` quản lý state và thao tác.
- `accessControlConfig.js` chứa danh mục quyền và cấu hình vai trò mặc định.
- `data/accessControlDemoData.js` chứa fixture xem trước được đánh dấu rõ.
- `utils/` chứa tiện ích xuất CSV.
- `styles/` chứa style của feature.

Backend hiện chưa có RBAC API dành cho admin. Vì vậy tài khoản, vai trò và nhật ký trên màn hình được ghi rõ là dữ liệu xem trước. Thay đổi quyền/vai trò được lưu trong local storage của trình duyệt, chưa cập nhật phân quyền trên server. Khi backend có API admin đã xác thực, thay nguồn fixture bằng API đó.
