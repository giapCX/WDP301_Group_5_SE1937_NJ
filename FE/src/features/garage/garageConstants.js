export const GARAGE_TASKS_PATH = '/garage/tasks';

export const TASK_TYPES = {
  HANDOVER_OUT: 'Kiểm tra trước chuyến',
  RETURN_IN: 'Tiếp nhận xe',
  MAINTENANCE: 'Bảo dưỡng',
};

export const TASK_STATUSES = {
  pending: { label: 'Chờ thực hiện', tone: 'red', icon: 'clock' },
  in_progress: { label: 'Đang thực hiện', tone: 'purple', icon: 'route' },
  completed: { label: 'Đã hoàn thành', tone: 'teal', icon: 'check' },
  failed: { label: 'Không đạt', tone: 'red', icon: 'help' },
};

export const CHECKLIST_ITEMS = [
  ['exterior', 'Ngoại thất'], ['interior', 'Nội thất'], ['tires', 'Lốp xe'], ['lights', 'Đèn'],
  ['brakes', 'Phanh'], ['fuel', 'Nhiên liệu'], ['documents', 'Giấy tờ'], ['safety', 'Thiết bị an toàn'],
];
export const CHECKLIST_LABELS = Object.fromEntries(CHECKLIST_ITEMS);

export const INSPECTION_RESULTS = {
  passed: 'Đạt', pass: 'Đạt', failed: 'Không đạt', fail: 'Không đạt',
};
