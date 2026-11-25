export const MAINTENANCE_APPROVALS_PATH = '/manager/maintenance-approvals';

export const MANAGER_NAVIGATION = [
  { label: 'Duyệt ngoại lệ / Hoàn tiền', href: '/manager/operation-approvals', icon: 'check' },
  { label: 'Duyệt phiếu bảo dưỡng', href: MAINTENANCE_APPROVALS_PATH, icon: 'wrench' },
  { label: 'Tổng quan & Báo cáo', href: '/manager/dashboard', icon: 'grid' },
  { label: 'Quản lý đội xe', href: '/manager/fleet', icon: 'car' },
  { label: 'Hiệu suất tài xế', href: '/manager/drivers', icon: 'users' },
  { label: 'Doanh thu & Tài chính', href: '/manager/revenue', icon: 'chart' },
  { label: 'Phê duyệt & Định mức', href: '/manager/approvals', icon: 'check' },
  { label: 'Bảng giá dịch vụ', href: '/manager/pricing', icon: 'chart' },
  { label: 'Chính sách dịch vụ', href: '/manager/policies', icon: 'settings' },
  { label: 'Khuyến mãi', href: '/manager/promotions', icon: 'chart' },
  { label: 'Nhật ký hoạt động', href: '/manager/audit', icon: 'check' },
];

export const VEHICLE_STATUS_META = {
  available: { label: 'Sẵn sàng cho thuê', tone: 'ready', color: '#16a58d' },
  in_use: { label: 'Đang có khách thuê', tone: 'rented', color: '#3576dc' },
  ongoing: { label: 'Đang có khách thuê', tone: 'rented', color: '#3576dc' },
  maintenance: { label: 'Đang bảo dưỡng', tone: 'maintenance', color: '#f0a43a' },
  pending: { label: 'Chờ duyệt hồ sơ', tone: 'pending', color: '#8c72d8' },
  pending_review: { label: 'Chờ duyệt hồ sơ', tone: 'pending', color: '#8c72d8' },
  approved: { label: 'Đã phê duyệt', tone: 'ready', color: '#16a58d' },
  withdrawn: { label: 'Đã tạm ngưng', tone: 'paused', color: '#95a2b3' },
  unavailable: { label: 'Không khả dụng', tone: 'paused', color: '#95a2b3' },
};

export const ALERT_TYPE_META = {
  maintenance: { label: 'Bảo dưỡng', icon: 'wrench', tone: 'warning' },
  incident: { label: 'Sự cố', icon: 'alert', tone: 'danger' },
};

export const DASHBOARD_PERIODS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Intl.DateTimeFormat('vi-VN', { month: 'long' }).format(new Date(2020, index, 1)),
}));
