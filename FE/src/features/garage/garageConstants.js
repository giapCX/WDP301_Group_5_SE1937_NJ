export const GARAGE_TASKS_PATH = '/garage/tasks';

export const TASK_TYPES = {
  HANDOVER_OUT: 'Kiểm tra trước chuyến',
  RETURN_IN: 'Tiếp nhận xe',
  MAINTENANCE: 'Bảo dưỡng',
};

export const GARAGE_TASK_VIEWS = [
  {
    key: 'all', label: 'Danh sách nhiệm vụ', title: 'Nhiệm vụ Gara', icon: 'grid',
    description: 'Kiểm tra trước chuyến, tiếp nhận xe và theo dõi bảo dưỡng.',
    emptyTitle: 'Chưa có nhiệm vụ đang mở',
    emptyDescription: 'Chuyến Operator phân công, lượt xe chờ tiếp nhận và phiếu bảo dưỡng đang mở sẽ xuất hiện ở đây.',
  },
  {
    key: 'handover', type: 'HANDOVER_OUT', label: 'Kiểm tra & bàn giao', icon: 'list',
    description: 'Mở checklist trước chuyến và theo dõi biên bản bàn giao cho tài xế.',
    emptyTitle: 'Chưa có xe chờ kiểm tra hoặc bàn giao',
  },
  {
    key: 'returns', type: 'RETURN_IN', label: 'Tiếp nhận & hư hỏng', icon: 'car',
    description: 'Đối chiếu tình trạng lúc nhận xe và lập báo cáo hư hỏng nếu cần.',
    emptyTitle: 'Chưa có xe chờ tiếp nhận',
  },
  {
    key: 'maintenance', type: 'MAINTENANCE', label: 'Phiếu bảo dưỡng', icon: 'wrench',
    description: 'Ghi kết quả sửa chữa, kiểm tra lại và theo dõi phiếu chờ Manager duyệt.',
    emptyTitle: 'Chưa có phiếu bảo dưỡng đang mở',
  },
].map((view) => ({ ...view, search: view.type ? `?view=${view.key}` : '' }));

export function getGarageTaskView(search) {
  const key = new URLSearchParams(search).get('view');
  return GARAGE_TASK_VIEWS.find((view) => view.key === key) ?? GARAGE_TASK_VIEWS[0];
}

export const TASK_STATUSES = {
  pending: { label: 'Chờ thực hiện', tone: 'red' },
  in_progress: { label: 'Đang thực hiện', tone: 'purple' },
  awaiting_approval: { label: 'Chờ Manager duyệt', tone: 'purple' },
  completed: { label: 'Đã hoàn thành', tone: 'teal' },
  failed: { label: 'Không đạt', tone: 'red' },
};

export const CHECKLIST_ITEMS = [
  ['exterior', 'Ngoại thất'], ['interior', 'Nội thất'], ['tires', 'Lốp xe'], ['lights', 'Đèn'],
  ['brakes', 'Phanh'], ['fuel', 'Nhiên liệu'], ['documents', 'Giấy tờ'], ['safety', 'Thiết bị an toàn'],
];
export const CHECKLIST_LABELS = Object.fromEntries(CHECKLIST_ITEMS);

export const INSPECTION_RESULTS = {
  passed: 'Đạt', pass: 'Đạt', failed: 'Không đạt', fail: 'Không đạt',
};
