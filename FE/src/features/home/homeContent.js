export const services = [
  {
    id: 'roundtrip', icon: 'sync_alt', title: 'Đưa đón khứ hồi',
    description: 'Xe đưa bạn đến nơi rồi quay lại đón theo giờ hẹn.',
    details: ['Đưa đón sân bay, khách sạn hoặc khu nghỉ dưỡng', 'Chủ động thời gian tại điểm đến'],
    steps: ['Đón tại điểm hẹn', 'Đến nơi', 'Đón về theo lịch'],
    fit: 'Phù hợp khi bạn đã có giờ đi và giờ về.',
  },
  {
    id: 'tour', icon: 'route', title: 'Tham quan theo lộ trình / Tour',
    description: 'Xe và tài xế đồng hành qua các điểm dừng bạn chọn.',
    details: ['Phù hợp với chuyến trong ngày hoặc nhiều ngày', 'Trao đổi thêm điểm dừng khi đặt xe'],
    steps: ['Đón khách', 'Ghé các điểm tham quan', 'Kết thúc tour'],
    fit: 'Phù hợp khi bạn cần xe đi cùng qua nhiều điểm dừng.',
  },
];

export const standards = [
  ['verified_user', 'Xe được phê duyệt', 'Tra cứu xe đang ở trạng thái khả dụng.'],
  ['airline_seat_recline_extra', 'Chọn hạng xe phù hợp', 'Lọc xe theo số chỗ cho gia đình hoặc đoàn.'],
  ['receipt_long', 'Giá rõ ràng', 'Xem giá theo ngày trước khi xác nhận hành trình.'],
  ['support_agent', 'Hỗ trợ hành trình', 'Liên hệ tổng đài khi cần tư vấn hoặc đổi lịch.'],
];

export const destinations = [
  { name: 'Vũng Tàu', description: 'Ghé biển và các điểm tham quan ven thành phố.' },
  { name: 'Đà Lạt', description: 'Lên lịch ghé các điểm tham quan trên cao nguyên.' },
  { name: 'Cần Thơ', description: 'Khám phá miền sông nước theo lịch trình riêng.' },
];
export const hotline = { href: 'tel:19006886', label: '1900 6886' };
