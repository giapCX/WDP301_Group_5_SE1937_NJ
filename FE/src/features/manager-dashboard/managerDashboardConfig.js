export const MAINTENANCE_APPROVALS_PATH = '/manager/maintenance-approvals';

export const MANAGER_NAVIGATION = [
  { label: 'Tổng quan & Báo cáo', href: '/manager/dashboard', icon: 'grid' },
  { label: 'Doanh thu & Tài chính', href: '/manager/revenue', icon: 'chart' },
  { label: 'Phê duyệt vận hành', href: '/manager/operation-approvals', icon: 'check' },
  { label: 'Duyệt bảo dưỡng an toàn', href: '/manager/maintenance-approvals', icon: 'wrench' },
  { label: 'Bảng giá dịch vụ', href: '/manager/pricing', icon: 'chart' },
  { label: 'Chính sách dịch vụ', href: '/manager/policies', icon: 'settings' },
  { label: 'Hồ sơ hợp đồng', href: '/manager/contract-profile', icon: 'settings' },
  { label: 'Khuyến mãi', href: '/manager/promotions', icon: 'chart' },
  { label: 'Nhật ký hoạt động', href: '/manager/audit', icon: 'check' },
];

export const DASHBOARD_PERIODS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Intl.DateTimeFormat('vi-VN', { month: 'long' }).format(new Date(2020, index, 1)),
}));
