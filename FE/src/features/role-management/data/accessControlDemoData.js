// Preview-only records. Replace with the admin API once RBAC endpoints are available.
export const DEMO_ROLES = [
  { id: 'admin', name: 'Quản trị viên', short: 'QT', color: 'navy' },
  { id: 'manager', name: 'Quản lý', short: 'QL', color: 'violet' },
  { id: 'operator', name: 'Điều phối viên', short: 'ĐP', color: 'blue' },
  { id: 'garage', name: 'Nhân viên gara', short: 'G', color: 'mint' },
  { id: 'renter', name: 'Khách thuê xe', short: 'K', color: 'orange' },
];

export const DEMO_ADMIN_PROFILE = { name: 'Việt Anh', role: 'Quản trị viên', initials: 'VA' };

export const DEMO_ACCOUNTS = [
  { name: 'Nguyễn Việt Anh', email: 'vietanh@viettour.vn', role: 'Quản trị viên', status: 'Hoạt động', initials: 'VA', tone: 'avatar-blue', lastActivity: '2 phút trước' },
  { name: 'Trần Hồng Nhung', email: 'nhung.tran@viettour.vn', role: 'Quản lý', status: 'Hoạt động', initials: 'TN', tone: 'avatar-violet', lastActivity: '18 phút trước' },
  { name: 'Lê Quốc Vinh', email: 'vinh.le@viettour.vn', role: 'Điều phối viên', status: 'Hoạt động', initials: 'LV', tone: 'avatar-green', lastActivity: '1 giờ trước' },
  { name: 'Phạm Quốc Khải', email: 'khai.pham@viettour.vn', role: 'Nhân viên gara', status: 'Chờ xác minh', initials: 'PK', tone: 'avatar-orange', lastActivity: 'Hôm qua' },
];

export const DEMO_AUDIT_EVENTS = [
  { id: 'permission-updated', title: 'Đã cập nhật quyền của vai trò Điều phối viên', actor: 'Nguyễn Việt Anh', time: '10:42 hôm nay', type: 'success' },
  { id: 'account-created', title: 'Tạo tài khoản mới cho Nhân viên gara', actor: 'Trần Hồng Nhung', time: '09:18 hôm nay', type: 'info' },
  { id: 'new-device-login', title: 'Đăng nhập từ thiết bị mới', actor: 'Lê Quốc Vinh', time: 'Hôm qua', type: 'warning' },
  { id: 'password-changed', title: 'Thay đổi mật khẩu tài khoản quản trị', actor: 'Nguyễn Việt Anh', time: 'Hôm qua', type: 'success' },
];
