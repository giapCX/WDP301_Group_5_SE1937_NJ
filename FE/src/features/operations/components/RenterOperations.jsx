import { useState } from 'react';
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
  const [tab, setTab] = useState('changes');
  const result = useOperations(`/renter/bookings/${booking.booking_id}/operations`);
  function refresh() { result.refresh(); onUpdated(); }
  return <section className="op-card renter-booking-details"><div className="rv-details-heading"><div><span className="rv-details-eyebrow">CHI TIẾT ĐƠN #{booking.booking_id}</span><h2>Quản lý chuyến đi</h2></div></div>
    <div className="rv-detail-tabs" role="group" aria-label="Nhóm yêu cầu của đơn đặt xe">{Object.entries({changes:'Lịch trình',charges:'Phụ phí',cancellation:'Hủy & hoàn tiền',incidents:'Sự cố & hỗ trợ',history:'Lịch sử xử lý'}).map(([key,label])=><button type="button" key={key} className="rv-button" aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div><Feedback error={result.error}/><button className="dispatch-button subtle" onClick={result.refresh}>Cập nhật yêu cầu</button>
    {result.loading && <p role="status">Đang tải…</p>}
    {tab === 'cancellation' && <>
    {['pending', 'quoted', 'awaiting_payment', 'confirmed'].includes(booking.booking_status) && new Date(booking.pickup_time) > new Date() && result.data?.cancellation?.status !== 'pending' && <OperatorCancellation id={booking.booking_id} renter onDone={refresh}/>}
    {result.data?.cancellation && <CancellationCard renter booking={{ ...booking, cancellation: result.data.cancellation }} onDone={refresh}/>}
    </>}
    {tab === 'changes' && <>
    {((booking.booking_status === 'confirmed' && new Date(booking.pickup_time) > new Date()) || booking.booking_status === 'in_progress') && <RenterChangeForm booking={booking} onDone={refresh}/>}
    {result.data?.changes.map((request) => <article key={request.change_request_id} className="op-card"><h3>Đổi lịch #{request.change_request_id} · {labels[request.request_status]}</h3><p>{request.reason}</p><p>{dateTime(request.after.pickup_time)} → {dateTime(request.after.estimated_end_time)}</p><p>Giá trước ưu đãi đề xuất: {money(request.after.estimated_price)} · Chênh lệch {money(request.price_difference)}</p>{request.rejection_reason && <p>{request.rejection_reason}</p>}
      {request.price_offer && <p>Operator: {request.price_offer.reason} · {request.price_offer.accepted_at ? 'Bạn đã chấp nhận giá' : 'Chờ bạn xem xét'}</p>}
      {request.request_status === 'pending' && request.price_offer && !request.price_offer.accepted_at && <ActionForm title="Chấp nhận giá thay đổi" path={`/renter/bookings/change-requests/${request.change_request_id}/accept-price`} payload={{ offerId: request.price_offer.id }} onDone={refresh} label="Đồng ý giá thay đổi"/>}
    </article>)}
    {!result.loading && !result.data?.changes?.length && <p className="op-muted">Chưa có yêu cầu thay đổi lịch trình.</p>}
    </>}
    {tab === 'charges' && <><h3>Phụ phí</h3>{!result.data?.charges?.length && <p>Chưa có phụ phí.</p>}{result.data?.charges?.map((charge) => <ChargeCard renter key={charge.charge_id} record={{ ...charge, booking_id: booking.booking_id }} onDone={refresh}/>)}
    </>}
    {tab === 'cancellation' && <><h3>Hoàn tiền</h3><p>Đã hoàn mô phỏng: {money(result.data?.refunded_total || 0)}</p>{result.data?.refunds?.map((record) => <RefundCard key={record.refund_id} record={record}/>)}
    </>}
    {tab === 'incidents' && <>
    {['confirmed', 'in_progress', 'completed'].includes(booking.booking_status) && <IncidentReportForm path={`/renter/bookings/${booking.booking_id}/incidents`} onDone={refresh}/>}
    {result.data?.incidents?.map((record) => <IncidentCard key={record.incident_id} record={record} renter/>)}
    {!result.loading && !result.data?.incidents?.length && <p className="op-muted">Chưa có sự cố được ghi nhận.</p>}
    </>}
    {tab === 'history' && <><h3>Lịch sử xử lý</h3>{!result.data?.events?.length ? <p className="op-muted">Chưa có hoạt động xử lý.</p> : <History items={result.data.events}/>}</>}
  </section>;
}
