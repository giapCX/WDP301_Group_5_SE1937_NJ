export const garageSections = [
  {
    id: 'overview',
    label: 'Tổng quan',
    icon: 'dashboard',
    description: 'Mọi công việc trong ca, gọn trong một nơi.',
  },
  {
    id: 'inspections',
    label: 'Kiểm định xe',
    icon: 'clipboard',
    description: 'Kiểm tra tình trạng xe và gửi đề xuất cho quản lý.',
  },
  {
    id: 'intakes',
    label: 'Tiếp nhận xe',
    icon: 'garage',
    description: 'Đối chiếu hồ sơ và ghi nhận xe từ chủ xe vào gara.',
  },
  {
    id: 'handovers',
    label: 'Bàn giao xe',
    icon: 'delivery',
    description: 'Chuẩn bị xe và lập biên bản bàn giao cho khách thuê.',
  },
  {
    id: 'returns',
    label: 'Nhận trả xe',
    icon: 'history',
    description: 'Đối chiếu tình trạng trước và sau chuyến thuê.',
  },
  {
    id: 'incidents',
    label: 'Báo cáo sự cố',
    icon: 'alert',
    description: 'Ghi nhận hư hỏng và chuyển bộ phận vận hành xử lý.',
  },
  {
    id: 'history',
    label: 'Lịch sử công việc',
    icon: 'clock',
    description: 'Theo dõi các thao tác và biên bản đã ghi nhận.',
  },
];
export const taskKinds = {
  inspection: 'Kiểm định',
  intake: 'Tiếp nhận',
  handover: 'Bàn giao',
  return: 'Nhận trả',
};
export const sectionKinds = {
  inspections: 'inspection',
  intakes: 'intake',
  handovers: 'handover',
  returns: 'return',
};
export const statusLabels = {
  pending: 'Chờ thực hiện',
  draft: 'Bản nháp',
  in_progress: 'Đang thực hiện',
  submitted: 'Chờ duyệt',
  completed: 'Hoàn thành',
  approved: 'Đã duyệt',
  revision_required: 'Yêu cầu bổ sung',
  rejected: 'Không được duyệt',
  reported: 'Đã gửi vận hành',
  investigating: 'Đang xác minh',
  resolved: 'Đã xử lý',
};
export const conditionFields = [
  ['exterior', 'Ngoại thất'],
  ['interior', 'Nội thất'],
  ['engine', 'Động cơ / vận hành'],
  ['tires', 'Lốp & phanh'],
];
export const conditionLabels = {
  good: 'Tốt / bình thường',
  attention: 'Cần kiểm tra thêm',
  damaged: 'Có hư hỏng',
};
export const bangkokDate = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(
    new Date(),
  );
export const displayTime = (value) =>
  new Date(value).toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  });
export const displayDate = (value) =>
  new Date(value).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
  });

export function taskBlockers(task) {
  if (Array.isArray(task.blockers)) return task.blockers;
  const checks =
    task.kind === 'intake'
      ? [
          ['inspection', 'Chưa có phê duyệt kiểm định'],
          ['agreement', 'Hợp đồng quản lý chưa ký'],
        ]
      : task.kind === 'handover'
        ? [
            ['agreement', 'Hợp đồng thuê chưa ký'],
            ['payment', 'Chưa xác nhận thanh toán'],
            ['identity', 'Hồ sơ người thuê chưa xác minh'],
            ['atGarage', 'Xe chưa sẵn sàng tại gara'],
          ]
        : [];
  return checks
    .filter(([key]) => !task.requirements[key])
    .map(([, label]) => label);
}

export function validateGarageReport(task, report) {
  if (taskBlockers(task).length)
    return 'Công việc chưa đủ điều kiện để hoàn tất.';
  if (
    report.odometer === '' ||
    !Number.isSafeInteger(Number(report.odometer)) ||
    Number(report.odometer) < task.odometer
  )
    return `Số km phải là số nguyên và không nhỏ hơn ${task.odometer.toLocaleString('vi-VN')} km đã ghi nhận.`;
  if (
    report.fuel === '' ||
    !Number.isSafeInteger(Number(report.fuel)) ||
    Number(report.fuel) < 0 ||
    Number(report.fuel) > 100
  )
    return 'Mức nhiên liệu / pin phải từ 0 đến 100%.';
  if (
    conditionFields.some(
      ([key]) => !Object.hasOwn(conditionLabels, report[key]),
    )
  )
    return 'Vui lòng đánh giá đầy đủ 4 hạng mục tình trạng xe.';
  if (
    conditionFields.some(([key]) => report[key] !== 'good') &&
    !report.note?.trim()
  )
    return 'Vui lòng mô tả hạng mục cần kiểm tra hoặc hư hỏng.';
  if (
    task.kind === 'inspection' &&
    !['pass', 'revision', 'reject'].includes(report.recommendation)
  )
    return 'Vui lòng chọn đề xuất kiểm định.';
  if (
    task.kind === 'inspection' &&
    report.recommendation === 'pass' &&
    conditionFields.some(([key]) => report[key] !== 'good')
  )
    return 'Xe có hạng mục bất thường; hãy chọn yêu cầu bổ sung hoặc không đạt.';
  if (task.kind !== 'inspection' && !report.confirmed)
    return 'Cần ghi nhận xác nhận của bên giao / nhận xe.';
  return '';
}

export const isFinished = (task) => ['completed', 'submitted', 'approved', 'revision_required', 'rejected'].includes(task.status);
