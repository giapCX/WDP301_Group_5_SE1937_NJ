export const ADMIN_NAVIGATION = [
  { label: 'Tổng quan', icon: 'grid', workspace: 'dashboard' },
  { label: 'Quản lý người dùng', icon: 'users', workspace: 'users' },
  { label: 'Vai trò & quyền', icon: 'shield', workspace: 'permissions' },
  { label: 'Nhật ký', icon: 'lock', workspace: 'audit' },
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
      { id: 'vehicle.read', label: 'Xem hồ sơ và tình trạng phương tiện' },
      { id: 'vehicle.write', label: 'Đăng ký xe mới và cập nhật hồ sơ xe' },
      { id: 'vehicle.review', label: 'Duyệt hồ sơ xe và xác nhận kiểm định' },
      { id: 'listing.manage', label: 'Quản lý danh sách xe cho thuê' },
      { id: 'garage.manage', label: 'Tiếp nhận và bàn giao xe tại gara' },
    ],
  },
  {
    id: 'drivers',
    title: 'HỒ SƠ TÀI XẾ',
    permissions: [
      { id: 'driver.read', label: 'Xem hồ sơ và hiệu suất tài xế' },
      { id: 'driver.write', label: 'Tạo và cập nhật hồ sơ giấy phép' },
      { id: 'driver.review', label: 'Phê duyệt tài xế nhận chuyến' },
    ],
  },
  {
    id: 'pricing',
    title: 'BẢNG GIÁ & CHÍNH SÁCH',
    permissions: [
      { id: 'pricing.manage', label: 'Tạo và cập nhật bảng giá dịch vụ' },
      { id: 'policy.manage', label: 'Quản lý chính sách hủy và phụ phí' },
      { id: 'promotion.manage', label: 'Tạo và quản lý chương trình khuyến mãi' },
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

export const ACCESS_TABS = ['Ma trận phân quyền', 'Vai trò', 'Quyền truy cập'];
export const ACCOUNT_FILTERS = ['Tất cả', 'Hoạt động', 'Đã khóa', 'Ngừng hoạt động'];

export function createDefaultMatrix(roles) {
  const matrix = {};
  for (const group of PERMISSION_GROUPS) {
    for (const permission of group.permissions) {
      matrix[permission.id] = Object.fromEntries(
        roles.map((role) => [role.id, role.permissions?.includes(permission.id) ?? false]),
      );
    }
  }
  return matrix;
}

export function countPermissions(matrix) {
  return Object.values(matrix).reduce((count, roles) => count + Object.values(roles).filter(Boolean).length, 0);
}
