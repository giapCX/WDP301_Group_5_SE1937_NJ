import { dateTime } from '../api/renterApi';

const steps = ['Hợp đồng', 'Thanh toán', 'Chờ nhận xe', 'Đang thuê', 'Đã trả xe'];
const phases = { pending: 0, awaiting_payment: 1, confirmed: 2, ongoing: 3, completed: 4 };
const conditionNames = { exterior: 'Ngoại thất', interior: 'Nội thất', engine: 'Động cơ', tires: 'Lốp xe' };
const conditionLabels = { good: 'Tốt', attention: 'Cần chú ý', damaged: 'Hư hỏng' };

function Receipt({ label, record }) {
  if (!record) return null;
  return <details>
    <summary>{label}</summary>
    <p>{dateTime(record.occurred_at)} · ODO {record.odometer_km ?? '—'} km · Nhiên liệu/pin {record.fuel_level_pct ?? '—'}%</p>
    <ul>{Object.entries(conditionNames).map(([key, name]) => <li key={key}>
      {name} · {conditionLabels[record.condition?.[key]] || 'Chưa ghi nhận'}
    </li>)}</ul>
    {record.condition?.note && <p>{record.condition.note}</p>}
    {record.renter_response === 'not_confirmed' && <p>Garage đã ghi nhận xe về. Hiện trạng chưa được khách xác nhận.</p>}
  </details>;
}

export default function RentalJourney({ data, expired }) {
  const { booking, agreement, handovers } = data;
  const phase = expired ? undefined : phases[booking.status];
  const message = {
    pending: booking.review_info?.required !== false ? 'Manager đang kiểm tra yêu cầu thuê.'
      : !agreement?.signing_info?.renter_signed_at ? 'Hợp đồng đã được lập. Bạn có thể mở và ký ngay.'
      : !agreement?.operator_intake?.confirmed_at ? 'Đang chờ Operator rà soát hợp đồng.'
      : 'Đang chờ Manager ký đại diện XeDi.',
    awaiting_payment: agreement?.status === 'signed' ? 'Hợp đồng đã đủ xác nhận. Hoàn tất tiền thuê và cọc trong thời hạn giữ xe.'
      : 'Khách thuê và XeDi xác nhận hợp đồng trước khi thanh toán.',
    confirmed: 'Đến gara theo giờ hẹn để đối chiếu giấy tờ, xem hiện trạng và nhận xe.',
    ongoing: 'Garage đã giao xe. Đến điểm trả xe theo giờ hẹn để Garage ghi nhận hiện trạng.',
    completed: 'Garage đã nhận lại xe. Theo dõi giao dịch và trạng thái tiền cọc bên dưới.',
  }[booking.status];
  return <section className="renter-card">
    <h2>Tiến độ chuyến thuê</h2>
    {phase !== undefined && <ol className="rental-journey-steps">
      {steps.map((label, index) => <li key={label} aria-current={phase === index ? 'step' : undefined} data-completed={phase > index}>{label}</li>)}
    </ol>}
    {expired || booking.status === 'expired' ? <p>Yêu cầu đã hết hạn giữ xe. Vui lòng chọn lại lịch nếu vẫn muốn thuê.</p>
      : booking.status === 'rejected' ? <p>Manager đã từ chối yêu cầu. {booking.review_info?.reason}</p>
      : message && <p>{message}</p>}
    <Receipt label="Biên bản giao xe" record={handovers?.pickup} />
    <Receipt label="Biên bản nhận trả xe" record={handovers?.return} />
  </section>;
}
