export const operationSections = [
  { id: 'overview', label: 'Tổng quan', icon: 'gear' },
  { id: 'bookings', label: 'Booking chờ xử lý', icon: 'calendar' },
  { id: 'listings', label: 'Tin xe', icon: 'car' },
  { id: 'incidents', label: 'Sự cố', icon: 'info' },
  { id: 'violations', label: 'Vi phạm', icon: 'shield' },
  { id: 'disputes', label: 'Tranh chấp', icon: 'document' },
  { id: 'complaints', label: 'Khiếu nại', icon: 'people' },
  { id: 'overdue', label: 'Xe quá hạn', icon: 'clock' },
];

export const operationSectionTitles = Object.fromEntries(
  operationSections.map(({ id, label }) => [id, label]),
);

export const operationStatusLabels = {
  pending: 'Chờ xử lý',
  awaiting_payment: 'Chờ ký và thanh toán',
  confirmed: 'Đã xác nhận',
  ongoing: 'Đang thuê',
  completed: 'Hoàn tất',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn',
  published: 'Đang hoạt động',
  suspended: 'Tạm dừng',
  archived: 'Đã lưu trữ',
  reported: 'Mới tiếp nhận',
  investigating: 'Đang xác minh',
  in_progress: 'Đang xử lý',
  under_review: 'Đang xem xét',
  awaiting_response: 'Chờ phản hồi',
  pending_manager: 'Chờ Manager quyết định',
  resolved: 'Đã giải quyết',
  escalated: 'Đã chuyển cấp',
  closed: 'Đã đóng',
  handled: 'Đã xử lý',
};

export const operationSectionStatuses = {
  bookings: ['pending', 'awaiting_payment', 'confirmed', 'ongoing', 'completed', 'cancelled', 'rejected', 'expired'],
  listings: ['draft', 'pending_review', 'published', 'suspended', 'archived', 'rejected'],
  incidents: ['reported', 'investigating', 'in_progress', 'awaiting_response', 'pending_manager', 'resolved', 'closed'],
  violations: ['reported', 'investigating', 'awaiting_response', 'pending_manager', 'resolved', 'closed'],
  disputes: ['reported', 'investigating', 'under_review', 'awaiting_response', 'pending_manager', 'resolved', 'escalated', 'closed'],
  complaints: ['reported', 'investigating', 'under_review', 'awaiting_response', 'pending_manager', 'resolved', 'closed'],
  overdue: ['ongoing'],
};

export const formatOperationMoney = (value) =>
  `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} ₫`;

export const formatOperationDate = (value) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

export function getCaseUpdater(section, api) {
  if (section === 'disputes') return api.updateDispute;
  if (section === 'complaints') return api.updateComplaint;
  return api.updateIncident;
}
