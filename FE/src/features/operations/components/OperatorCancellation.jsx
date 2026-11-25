import { useState } from 'react';
import useOperations from '../hooks/useOperations';
import { ActionForm, Feedback } from './OperationShared';
import { money } from '../../shared/booking/bookingConstants';
export default function OperatorCancellation({ id, renter, onDone }) {
  const [open, setOpen] = useState(false);
  const base = renter ? `/renter/bookings/${id}` : `/operator/operations/bookings/${id}`;
  const preview = useOperations(open ? base + '/cancellation-preview' : null);
  return <section><button type="button" className="dispatch-button subtle" onClick={() => setOpen(!open)}>{open ? 'Ẩn yêu cầu hủy' : 'Xem chính sách và yêu cầu hủy'}</button>{open && <><Feedback error={preview.error}/>{preview.loading && <p role="status">Đang kiểm tra chính sách…</p>}{preview.data && !preview.error && <>
    <p>Phí hủy dự kiến: {money(preview.data.fee)} · Dự kiến hoàn: {money(preview.data.refund_amount)}</p><p>{preview.data.policy?.name || 'Đơn chưa thu tiền'} · Yêu cầu cần Operator xem xét; chưa hủy ngay khi gửi.</p>
    {preview.data.fee > preview.data.paid_total && <p>Phí theo chính sách vượt tiền đã thu; yêu cầu này cần Manager xét ngoại lệ.</p>}
    <ActionForm title="Yêu cầu hủy chuyến" path={base + '/cancellation'} onDone={() => { setOpen(false); onDone(); }} label="Gửi yêu cầu hủy"/>
  </>}</>}</section>;
}
