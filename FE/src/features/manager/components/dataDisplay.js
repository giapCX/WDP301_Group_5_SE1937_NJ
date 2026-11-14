import './dataDisplay.css';

const labels = {
  default_commission_pct: 'Phí nền tảng mặc định',
  existing_agreements_unaffected: 'Giữ nguyên hợp đồng đã ký',
  free_cancel_before_hours: 'Thời gian hủy miễn phí trước chuyến đi',
  refund_if_eligible: 'Hoàn tiền nếu đủ điều kiện',
  refund_within_business_days: 'Thời hạn hoàn cọc',
  deduct_only_with_verified_basis: 'Chỉ khấu trừ khi có căn cứ xác minh',
  late_fee_per_hour: 'Phí trả xe trễ mỗi giờ',
  included_km_per_day: 'Số km bao gồm mỗi ngày',
  extra_km_fee: 'Phí mỗi km vượt mức',
  rental_contract_signing: 'Ký hợp đồng thuê xe',
  vehicle_custody: 'Quản lý phương tiện',
  listing_management: 'Quản lý tin đăng',
  booking_management: 'Quản lý đặt xe',
  owner_confirmation_per_booking: 'Cần chủ xe xác nhận từng lượt',
  commission_basis: 'Căn cứ tính phí',
  daily_rate: 'Giá thuê mỗi ngày',
  rental_fee_amount: 'Tiền thuê xe',
  deposit_amount: 'Tiền đặt cọc',
  start_at: 'Bắt đầu thuê',
  end_at: 'Kết thúc thuê',
  signature_method: 'Hình thức ký',
  status: 'Trạng thái',
  commission_default: 'Phí nền tảng',
  cancellation: 'Hủy chuyến',
  deposit_refund: 'Hoàn tiền đặt cọc',
  late_return: 'Trả xe trễ',
  mileage_policy: 'Chính sách quãng đường',
  rental_policy: 'Chính sách thuê xe',
  mileage: 'Giới hạn quãng đường',
  damage_handling: 'Xử lý hư hỏng',
  incident: 'Sự cố',
  'incident.recorded': 'Ghi nhận sự cố',
  'incident.operator_received': 'Operator tiếp nhận',
  'incident.submitted_to_manager': 'Gửi Manager xem xét',
  'incident.details.update': 'Cập nhật hồ sơ',
  vehicle_damage: 'Hư hỏng xe',
  theft: 'Mất cắp',
  safety: 'An toàn',
  other: 'Khác',
  accident: 'Tai nạn',
  illegal_use: 'Sử dụng xe trái phép',
  parts_swap: 'Nghi đánh tráo phụ tùng',
  technical_damage: 'Hư hỏng kỹ thuật',
  owner_dispute: 'Tranh chấp với chủ xe',
  traffic_violation: 'Vi phạm giao thông',
  withdrawal: 'Rút tiền',
  vehicle_approval: 'Duyệt phương tiện',
  listing_publication: 'Đăng tin phương tiện',
  overdue: 'Quá hạn',
  privacy_retention: 'Lưu trữ dữ liệu cá nhân',
};

const enumLabels = {
  rental_fee_excluding_security_deposit: 'Tiền thuê, không gồm tiền đặt cọc',
  electronic_acceptance: 'Ký điện tử',
  offline_paper: 'Ký giấy trực tiếp',
  offline_in_demo: 'Ký trực tiếp (bản demo)',
  pending_manager: 'Chờ Manager quyết định',
  need_more_information: 'Chờ Operator bổ sung',
  open: 'Đang mở',
  in_progress: 'Đang xử lý',
  under_review: 'Đang xem xét',
  escalated: 'Đã chuyển Manager',
  terminated: 'Đã chấm dứt',
  active: 'Đang áp dụng',
  suspended: 'Tạm khóa',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  pending_signatures: 'Chờ các bên ký',
  pending: 'Đang chờ xử lý',
  awaiting_payment: 'Chờ thanh toán',
  confirmed: 'Đã xác nhận',
  ongoing: 'Đang diễn ra',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  closed: 'Đã đóng',
  resolved: 'Đã xử lý',
  paid: 'Đã thanh toán',
  payable: 'Chờ thanh toán',
  draft: 'Bản nháp',
  submitted: 'Đã gửi',
  pending_review: 'Chờ xét duyệt',
  awaiting_response: 'Chờ phản hồi',
  reported: 'Mới tiếp nhận',
  investigating: 'Đang xem xét',
};

const permissionLabels = {
  'vehicle.register': 'Đăng ký phương tiện',
  'vehicle.view_own': 'Xem phương tiện của mình',
  'vehicle.inspect': 'Kiểm định phương tiện',
  'vehicle.intake': 'Tiếp nhận phương tiện',
  'listing.view': 'Xem tin xe',
  'booking.create': 'Tạo lượt đặt xe',
  'booking.cancel_own': 'Hủy lượt đặt của mình',
  'booking.view_own': 'Xem lượt đặt của mình',
  'agreement.sign_own': 'Ký hợp đồng quản lý',
  'rental.sign_own': 'Ký hợp đồng thuê xe',
  'payment.pay_own': 'Thanh toán lượt thuê',
  'finance.view_own': 'Xem tài chính của mình',
  'incident.report': 'Gửi báo cáo sự cố',
  'report.view': 'Xem báo cáo',
};

export function humanizeField(key) {
  if (labels[key]) return labels[key];
  return String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replaceAll('.', ' · ').replace(/^./, (letter) => letter.toUpperCase());
}

export function formatDisplayValue(value, key = '') {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') {
    if (key.includes('pct')) return `${value}%`;
    if (/(amount|fee|revenue|deposit|payout)/i.test(key)) return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
    if (key.includes('hours')) return `${value} giờ`;
    if (key.includes('days')) return `${value} ngày làm việc`;
    if (key.includes('km')) return `${new Intl.NumberFormat('vi-VN').format(value)} km`;
    return new Intl.NumberFormat('vi-VN').format(value);
  }
  if (typeof value === 'string') {
    if (enumLabels[value]) return enumLabels[value];
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString('vi-VN');
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => formatDisplayValue(item, key)).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([childKey, childValue]) => `${humanizeField(childKey)}: ${formatDisplayValue(childValue, childKey)}`).join(' · ');
  return String(value);
}

export function DataFields({ data, className = '' }) {
  const entries = Object.entries(data || {});
  if (!entries.length) return <p className="data-empty">Chưa có thông tin.</p>;
  return <dl className={`data-fields ${className}`}>{entries.map(([key, value]) => <div className="data-field" key={key}><dt>{humanizeField(key)}</dt><dd>{formatDisplayValue(value, key)}</dd></div>)}</dl>;
}

export function PermissionPills({ permissions = [] }) {
  return <div className="permission-pills">{permissions.map((permission) => <span className="permission-pill" key={permission}>{permissionLabels[permission] || humanizeField(permission)}</span>)}</div>;
}

export function ChangeSummary({ changes }) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return <span>{formatDisplayValue(changes)}</span>;
  return <div className="change-summary">{Object.entries(changes).map(([key, value]) => {
    const before = value && typeof value === 'object' ? value.before ?? value.old : undefined;
    const after = value && typeof value === 'object' ? value.after ?? value.new : value;
    return <div className="change-item" key={key}><strong>{humanizeField(key)}</strong><span>{before === undefined ? formatDisplayValue(after, key) : `${formatDisplayValue(before, key)} → ${formatDisplayValue(after, key)}`}</span></div>;
  })}</div>;
}
