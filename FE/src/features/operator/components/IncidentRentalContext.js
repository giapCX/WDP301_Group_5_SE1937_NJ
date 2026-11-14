import { useState } from 'react';
import SigningDialog from '../../contracts/components/SigningDialog';

const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa ghi nhận';

export default function IncidentRentalContext({ context }) {
  const [contract, setContract] = useState(null);
  if (!context) return <p>Chưa có chuyến thuê liên kết với hồ sơ sự cố.</p>;
  return <section className="operator-evidence">
    <h3>Căn cứ chuyến thuê</h3>
    <p>{context.bookingCode} · {dateTime(context.startAt)} → {dateTime(context.endAt)} (giờ Việt Nam)</p>
    {context.contracts?.map((item) => <button type="button" className="operator-secondary" key={item.id} onClick={() => setContract(item)}>
      {item.type === 'management' ? 'Hợp đồng ủy quyền' : 'Hợp đồng thuê'} · {item.number}
    </button>)}
    {context.handovers.length ? context.handovers.map((item) => <details key={item.id}>
      <summary>Biên bản {item.type === 'pickup' ? 'giao xe' : 'trả xe'} · {dateTime(item.occurredAt)}</summary>
      <p>ODO {item.odometerKm ?? '—'} km · Nhiên liệu/pin {item.fuelLevelPct ?? '—'}%</p>
      {item.note && <p>{item.note}</p>}
      {item.pickupVerification && <p>Garage đã ghi nhận đối chiếu người nhận, GPLX và điều kiện lái xe lúc {dateTime(item.pickupVerification.checked_at)}.</p>}
    </details>) : <p>Chưa có biên bản giao nhận đã xác nhận.</p>}
    {contract && <SigningDialog item={contract} view="staff" readOnly onClose={() => setContract(null)} />}
  </section>;
}
