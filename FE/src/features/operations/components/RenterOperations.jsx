import useOperations from '../hooks/useOperations';
import { ActionForm, Feedback, History, RefundCard, labels } from './OperationShared';
import ChargeCard from './ChargeCard';
import CancellationCard from './CancellationCard';
import OperatorCancellation from './OperatorCancellation';
import IncidentCard from './IncidentCard';
import IncidentReportForm from './IncidentReportForm';
import RenterChangeForm from './RenterChangeForm';
import { dateTime, money } from '../../bookings/bookingConstants';
import '../styles/operations.css';
export default function RenterOperations({ booking, onUpdated }) {
  const result = useOperations(`/renter/bookings/${booking.booking_id}/operations`);
  function refresh() { result.refresh(); onUpdated(); }
  return <section className="op-card"><h2>Yêu cầu và lịch sử xử lý</h2><p className="op-muted">Hiển thị tối đa 20 hồ sơ gần nhất mỗi loại.</p><Feedback error={result.error}/><button className="dispatch-button subtle" onClick={result.refresh}>Cập nhật yêu cầu</button>
    {result.loading && <p role="status">Đang tải…</p>}
    {['pending', 'quoted', 'awaiting_payment', 'confirmed'].includes(booking.booking_status) && new Date(booking.pickup_time) > new Date() && result.data?.cancellation?.status !== 'pending' && <OperatorCancellation id={booking.booking_id} renter onDone={refresh}/>}
    {result.data?.cancellation && <CancellationCard renter booking={{ ...booking, cancellation: result.data.cancellation }} onDone={refresh}/>}
    {((booking.booking_status === 'confirmed' && new Date(booking.pickup_time) > new Date()) || booking.booking_status === 'in_progress') && <RenterChangeForm booking={booking} onDone={refresh}/>}
    {result.data?.changes.map((request) => <article key={request.change_request_id} className="op-card"><h3>Đổi lịch #{request.change_request_id} · {labels[request.request_status]}</h3><p>{request.reason}</p><p>{dateTime(request.after.pickup_time)} → {dateTime(request.after.estimated_end_time)}</p><p>Giá trước ưu đãi đề xuất: {money(request.after.estimated_price)} · Chênh lệch {money(request.price_difference)}</p>{request.rejection_reason && <p>{request.rejection_reason}</p>}
      {request.price_offer && <p>Operator: {request.price_offer.reason} · {request.price_offer.accepted_at ? 'Bạn đã chấp nhận giá' : 'Chờ bạn xem xét'}</p>}
      {request.request_status === 'pending' && request.price_offer && !request.price_offer.accepted_at && <ActionForm title="Chấp nhận giá thay đổi" path={`/renter/bookings/change-requests/${request.change_request_id}/accept-price`} payload={{ offerId: request.price_offer.id }} onDone={refresh} label="Đồng ý giá thay đổi"/>}
    </article>)}
    <h3>Phụ phí</h3>{!result.data?.charges?.length && <p>Chưa có phụ phí.</p>}{result.data?.charges?.map((charge) => <ChargeCard renter key={charge.charge_id} record={{ ...charge, booking_id: booking.booking_id }} onDone={refresh}/>)}
    <h3>Hoàn tiền</h3><p>Đã hoàn mô phỏng: {money(result.data?.refunded_total || 0)}</p>{result.data?.refunds?.map((record) => <RefundCard key={record.refund_id} record={record}/>)}
    {['confirmed', 'in_progress', 'completed'].includes(booking.booking_status) && <IncidentReportForm path={`/renter/bookings/${booking.booking_id}/incidents`} onDone={refresh}/>}
    {result.data?.incidents?.map((record) => <IncidentCard key={record.incident_id} record={record} renter/>)}
    <History items={result.data?.events}/>
  </section>;
}
