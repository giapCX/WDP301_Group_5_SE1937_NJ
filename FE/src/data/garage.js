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

export function createGarageDemo() {
  const today = bangkokDate();
  const nextDate = new Date(`${today}T12:00:00+07:00`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const tomorrow = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
  }).format(nextDate);
  const rows = [
    [
      'GS-001',
      'inspection',
      'VinFast VF 8 Plus',
      '51K-482.16',
      'Nguyễn Hoàng Nam',
      '09:00',
      'pending',
      18240,
      75,
    ],
    [
      'GS-002',
      'handover',
      'Mazda CX-5 Premium',
      '51H-635.28',
      'Trần Minh Khoa',
      '09:30',
      'pending',
      25410,
      80,
    ],
    [
      'GS-003',
      'return',
      'Toyota Vios G',
      '51G-218.45',
      'Lê Thảo Nguyên',
      '10:30',
      'pending',
      42050,
      70,
    ],
    [
      'GS-004',
      'intake',
      'Kia Carnival Signature',
      '51L-706.39',
      'Phạm Quốc Bảo',
      '11:00',
      'pending',
      12300,
      60,
    ],
    [
      'GS-005',
      'inspection',
      'Hyundai Tucson',
      '51K-930.52',
      'Đỗ Thanh Tùng',
      '13:30',
      'draft',
      31000,
      65,
    ],
    [
      'GS-006',
      'handover',
      'Honda City RS',
      '51H-824.67',
      'Vũ Hà Anh',
      '14:00',
      'pending',
      19820,
      85,
    ],
    [
      'GS-007',
      'return',
      'Ford Ranger Wildtrak',
      '51D-382.90',
      'Nguyễn Đức Huy',
      '15:30',
      'pending',
      36500,
      90,
    ],
    [
      'GS-008',
      'intake',
      'Toyota Corolla Cross',
      '51L-192.83',
      'Trịnh Minh Hằng',
      '16:00',
      'pending',
      8500,
      70,
    ],
    [
      'GS-009',
      'inspection',
      'Mitsubishi Xpander',
      '51K-256.71',
      'Lý Minh Đức',
      '08:30',
      'pending',
      22400,
      60,
    ],
    [
      'GS-010',
      'handover',
      'Kia Seltos Premium',
      '51H-647.35',
      'Đặng Thu Hà',
      '09:00',
      'completed',
      15300,
      80,
    ],
  ];
  const tasks = rows.map(
    (
      [id, kind, vehicle, plate, contact, time, status, odometer, fuel],
      index,
    ) => ({
      id,
      kind,
      vehicle,
      plate,
      contact,
      status,
      odometer,
      fuel,
      schedule: `${index === 8 ? tomorrow : today}T${time}:00+07:00`,
      reference:
        kind === 'inspection'
          ? `KĐ-2026-${101 + index}`
          : kind === 'intake'
            ? `HĐQL-2026-${101 + index}`
            : `XD-2026-${201 + index}`,
      location: 'Gara Tân Bình',
      bay: index % 2 ? 'Khu B · Vị trí 02' : 'Khu A · Vị trí 01',
      requirements: {
        inspection: index !== 7,
        agreement: true,
        payment: index !== 5,
        identity: true,
        atGarage: true,
      },
      report:
        index === 4
          ? {
              odometer: '31000',
              fuel: '65',
              exterior: 'attention',
              note: 'Cần kiểm tra vết xước nhỏ ở cản sau.',
              photos: [],
            }
          : null,
    }),
  );
  return {
    version: 1,
    tasks,
    incidents: [],
    history: [
      {
        id: 'DEMO-H1',
        time: `${today}T08:45:00+07:00`,
        title: 'Hoàn tất bàn giao Kia Seltos Premium',
        detail: 'GS-010 · 51H-647.35',
        type: 'completed',
      },
    ],
  };
}

export function taskBlockers(task) {
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
    !Number.isFinite(Number(report.fuel)) ||
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
