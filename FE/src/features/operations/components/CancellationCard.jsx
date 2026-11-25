import { ActionForm, History, labels } from './OperationShared';
import { dateTime, money } from '../../bookings/bookingConstants';
export default function CancellationCard({ booking, renter, manager, onDone }) {
  const request = booking.cancellation;
  if (!request?.id) return null;
  return <article className="op-card"><h3>Yêu cầu hủy đơn #{booking.booking_id}</h3><p>{labels[request.status]} · {dateTime(request.requested_at)}</p><p>{request.reason}</p><p>Phí hủy: <strong>{money(request.fee)}</strong> · Dự kiến hoàn: <strong>{money(request.refund_amount)}</strong></p>
    <p>Chính sách: {request.policy?.name || 'Đơn chưa thu tiền'}{request.policy?.name && ` · ${request.policy.fee_percent}% giá chuyến · trước khởi hành ${Number(request.policy.hours_before).toFixed(1)} giờ`}</p>
    {request.decision_note && <p>Quyết định: {request.decision_note}</p>}
    {!renter && request.status === 'pending' && <ActionForm title="Xem xét hủy chuyến" path={`/${manager ? 'manager/operation-approvals' : 'operator/operations'}/bookings/${booking.booking_id}/cancellation-decision`} transform={(fields) => ({ ...fields, ...(manager ? { feeOverride: Number(fields.feeOverride) } : {}) })} payload={{ requestId: request.id }} onDone={onDone}>{manager && <label>Phí hủy giữ lại (₫, điều chỉnh ngoại lệ)<input name="feeOverride" type="number" min="0" step="1" required defaultValue={Math.min(request.fee, Math.max(0, (booking.paid_total || 0) - (booking.refunded_total || 0)))}/></label>}<label>Quyết định<select name="decision"><option value="approve">Duyệt hủy (giải phóng lịch và lập yêu cầu hoàn tiền)</option><option value="reject">Từ chối</option></select></label></ActionForm>}
    <History items={booking.operation_events}/>
  </article>;
}
