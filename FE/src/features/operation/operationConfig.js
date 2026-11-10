export const operationSections = [
  { id: 'overview', label: 'Tổng quan', icon: 'gear' },
  { id: 'vehicles', label: 'Hồ sơ xe & kiểm định', icon: 'car' },
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
  investigating: 'Đang xử lý',
  in_progress: 'Đang xử lý',
  under_review: 'Đang xem xét',
  awaiting_response: 'Chờ phản hồi',
  pending_manager: 'Chờ Manager quyết định',
  need_more_information: 'Cần bổ sung thông tin',
  resolved: 'Đã giải quyết',
  escalated: 'Đã chuyển cấp',
  closed: 'Đã đóng',
  handled: 'Đã xử lý',
  submitted: 'Chờ sàng lọc',
  revision_required: 'Cần bổ sung',
  pending_review: 'Chờ duyệt',
};

export const operationSectionStatuses = {
  vehicles: ['all', 'submitted', 'revision_required', 'pending_review'],
  bookings: ['all', 'pending', 'awaiting_payment', 'confirmed', 'ongoing', 'completed', 'cancelled', 'rejected', 'expired'],
  listings: ['all', 'draft', 'pending_review', 'published', 'suspended', 'archived', 'rejected'],
  incidents: ['all', 'reported', 'investigating', 'in_progress', 'awaiting_response', 'pending_manager', 'need_more_information', 'resolved', 'closed'],
  violations: ['all', 'reported', 'investigating', 'awaiting_response', 'pending_manager', 'resolved', 'closed'],
  disputes: ['all', 'reported', 'investigating', 'under_review', 'awaiting_response', 'pending_manager', 'need_more_information', 'resolved', 'escalated', 'closed'],
  complaints: ['all', 'reported', 'investigating', 'under_review', 'awaiting_response', 'pending_manager', 'need_more_information', 'resolved', 'closed'],
  overdue: ['ongoing'],
};

export const formatOperationMoney = (value) =>
  `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} ₫`;

export const formatOperationDate = (value) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';
