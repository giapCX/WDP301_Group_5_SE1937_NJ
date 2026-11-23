export const BOOKING_STATUSES = {
  pending: { label: 'Chờ duyệt', tone: 'red' },
  confirmed: { label: 'Đã xác nhận', tone: 'blue' },
  in_progress: { label: 'Đang di chuyển', tone: 'teal' },
  completed: { label: 'Hoàn thành', tone: 'gray' },
  cancelled: { label: 'Đã hủy', tone: 'gray' },
  rejected: { label: 'Đã từ chối', tone: 'red' },
};

export const BOOKING_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'in_progress', label: 'Đang thực hiện' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
  { key: 'rejected', label: 'Đã từ chối' },
];

export const money = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);

export const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—';

export const bookingCode = (id) => `VT-${String(id).padStart(6, '0')}`;
