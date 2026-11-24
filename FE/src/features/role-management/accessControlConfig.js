export const ACCESS_CONTROL_STORAGE_KEY = 'viettour-rbac-matrix';
export const ACCESS_CONTROL_ROLES_STORAGE_KEY = 'viettour-rbac-roles';

export const ADMIN_NAVIGATION = [
  { label: 'Tổng quan', icon: 'grid' },
  { label: 'Quản lý người dùng', icon: 'users' },
  { label: 'Quản lý vai trò & quyền', icon: 'shield' },
  { label: 'Danh sách xe', icon: 'car' },
  { label: 'Đặt xe & hợp đồng', icon: 'calendar' },
  { label: 'Báo cáo & thống kê', icon: 'chart' },
];

export const PERMISSION_GROUPS = [
  {
    id: 'accounts',
    title: 'QUẢN LÝ TÀI KHOẢN',
    permissions: [
      { id: 'account.read', label: 'Xem danh sách tài khoản và hồ sơ người dùng' },
      { id: 'account.write', label: 'Tạo mới và chỉnh sửa hồ sơ người dùng' },
      { id: 'account.lock', label: 'Khóa hoặc mở khóa tài khoản' },
      { id: 'role.assign', label: 'Gán vai trò và quản lý quyền truy cập' },
    ],
  },
  {
    id: 'vehicles',
    title: 'QUẢN LÝ XE & ĐIỀU PHỐI',
    permissions: [
      { id: 'vehicle.write', label: 'Đăng ký xe mới và cập nhật hồ sơ xe' },
      { id: 'vehicle.review', label: 'Duyệt hồ sơ xe và xác nhận kiểm định' },
      { id: 'listing.manage', label: 'Quản lý danh sách xe cho thuê' },
      { id: 'garage.manage', label: 'Tiếp nhận và bàn giao xe tại gara' },
    ],
  },
  {
    id: 'bookings',
    title: 'ĐẶT XE & HỢP ĐỒNG',
    permissions: [
      { id: 'booking.read.all', label: 'Xem và quản lý tất cả yêu cầu đặt xe' },
      { id: 'booking.review', label: 'Tạo, xác nhận hoặc từ chối booking' },
      { id: 'booking.change.read', label: 'Xem lịch sử và yêu cầu thay đổi lịch trình' },
      { id: 'contract.sign', label: 'Tạo và ký hợp đồng thuê xe' },
      { id: 'booking.read.own', label: 'Xem booking và hợp đồng của bản thân' },
    ],
  },
  {
    id: 'finance',
    title: 'TÀI CHÍNH & BÁO CÁO',
    permissions: [
      { id: 'report.read', label: 'Xem báo cáo doanh thu và đối soát' },
      { id: 'payment.manage', label: 'Xử lý thanh toán và yêu cầu hoàn tiền' },
      { id: 'audit.read', label: 'Xem thông báo và nhật ký hoạt động' },
    ],
  },
];

export const ROLE_PERMISSION_DEFAULTS = {
  admin: ['account.read', 'account.write', 'account.lock', 'role.assign', 'vehicle.write', 'vehicle.review', 'listing.manage', 'garage.manage', 'booking.read.all', 'booking.review', 'booking.change.read', 'contract.sign', 'report.read', 'payment.manage', 'audit.read'],
  manager: ['account.read', 'account.write', 'account.lock', 'role.assign', 'vehicle.write', 'vehicle.review', 'listing.manage', 'booking.read.all', 'booking.review', 'booking.change.read', 'contract.sign', 'report.read', 'payment.manage', 'audit.read'],
  operator: ['account.read', 'account.write', 'vehicle.write', 'vehicle.review', 'listing.manage', 'garage.manage', 'booking.read.all', 'booking.review', 'booking.change.read', 'contract.sign', 'audit.read'],
  garage: ['vehicle.review', 'garage.manage', 'audit.read'],
  renter: ['booking.change.read', 'contract.sign', 'booking.read.own'],
};

export const ACCESS_TABS = ['Ma trận phân quyền', 'Vai trò', 'Quyền truy cập'];
export const ACCOUNT_FILTERS = ['Tất cả', 'Hoạt động', 'Chờ xác minh'];

export function createDefaultMatrix(roles) {
  const matrix = {};
  for (const group of PERMISSION_GROUPS) {
    for (const permission of group.permissions) {
      matrix[permission.id] = Object.fromEntries(
        roles.map((role) => [role.id, ROLE_PERMISSION_DEFAULTS[role.id]?.includes(permission.id) ?? false]),
      );
    }
  }
  return matrix;
}

export function countPermissions(matrix) {
  return Object.values(matrix).reduce((count, roles) => count + Object.values(roles).filter(Boolean).length, 0);
}
