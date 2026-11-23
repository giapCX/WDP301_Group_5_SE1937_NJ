export const CHANGE_STATUSES = [
  { key: '', label: 'Tất cả', tone: 'gray' },
  { key: 'pending', label: 'Chờ duyệt', tone: 'red' },
  { key: 'approved', label: 'Đã duyệt', tone: 'teal' },
  { key: 'rejected', label: 'Đã từ chối', tone: 'gray' },
  { key: 'cancelled', label: 'Đã hủy', tone: 'gray' },
];

export const requestCode = (id) => `YC-${String(id).padStart(5, '0')}`;
