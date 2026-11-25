import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import OperationsLayout from '../components/OperationsLayout';
import useOperations from '../hooks/useOperations';
import { ActionForm, Feedback, Pager, RefundCard } from '../components/OperationShared';
import ChargeCard, { ChargeFields, chargePayload } from '../components/ChargeCard';
import IncidentCard from '../components/IncidentCard';
import CancellationCard from '../components/CancellationCard';
import IncidentReportForm from '../components/IncidentReportForm';
import OperatorCancellation from '../components/OperatorCancellation';
export default function OperationsPage({ manager = false }) {
  const [params, setParams] = useSearchParams();
  const tabs = manager ? { cancellations: 'Ngoại lệ hủy chuyến', incidents: 'Phê duyệt sự cố', refunds: 'Phê duyệt / hoàn tiền' } : { charges: 'Phụ phí', cancellations: 'Hủy chuyến', incidents: 'Sự cố', refunds: 'Theo dõi hoàn tiền' };
  const tab = tabs[params.get('tab')] ? params.get('tab') : Object.keys(tabs)[0];
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1), [bookingId, setBookingId] = useState(params.get('booking') || ''), [filter, setFilter] = useState(params.get('booking') || '');
  const path = tab === 'charges' ? '/operator/additional-charges' : `/${manager ? 'manager/operation-approvals' : 'operator/operations'}/${tab}`;
  const result = useOperations(path, { page, ...(status ? { status } : {}), ...(filter ? { booking_id: filter } : {}) });
  const refresh = result.refresh;
  return <OperationsLayout manager={manager} title={manager ? 'Phê duyệt ngoại lệ vận hành' : 'Xử lý booking và ngoại lệ'}>
    <div className="op-tabs">{Object.entries(tabs).map(([key, label]) => <button key={key} className="dispatch-button subtle" aria-pressed={tab === key} onClick={() => { setParams({ tab: key }); setPage(1); setStatus(''); }}>{label}</button>)}</div>
    <form className="op-actions" onSubmit={(event) => { event.preventDefault(); setFilter(bookingId); setPage(1); }}><label className="op-filter">Mã booking<input type="number" min="1" step="1" value={bookingId} onChange={(event) => setBookingId(event.target.value)}/></label><label className="op-filter">Trạng thái<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả</option>{(tab === 'charges' ? [['draft','Nháp'],['confirmed','Đã xác nhận'],['disputed','Tranh chấp'],['cancelled','Đã hủy']] : tab === 'incidents' ? [['open','Đang mở'],['resolved','Đã xử lý']] : [['pending','Chờ duyệt'],['approved','Đã duyệt'],['rejected','Từ chối'], ...(tab === 'refunds' ? [['completed','Đã hoàn']] : [])]).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="dispatch-button primary">Lọc</button><button className="dispatch-button subtle" type="button" onClick={refresh}>Làm mới</button></form>
    <Feedback error={result.error}/>{result.loading && <p role="status">Đang tải hồ sơ…</p>}
    {!manager && bookingId && <details className="op-card"><summary>Tạo hồ sơ cho đơn #{bookingId}</summary>
      {tab === 'charges' && <ActionForm title="Tạo phụ phí nháp" path={`/operator/bookings/${bookingId}/additional-charges`} transform={chargePayload} onDone={refresh}><ChargeFields/></ActionForm>}
      {tab === 'incidents' && <IncidentReportForm path={`/operator/operations/bookings/${bookingId}/incidents`} onDone={refresh}/>}
      {tab === 'cancellations' && <OperatorCancellation id={bookingId} onDone={refresh}/>}
    </details>}
    {!result.loading && !result.data?.items?.length && <p className="op-card">Không có hồ sơ phù hợp.</p>}
    {result.data?.items?.map((record) => tab === 'charges' ? <ChargeCard key={record.charge_id} record={record} onDone={refresh}/> : tab === 'cancellations' ? <CancellationCard key={record.booking_id} booking={record} manager={manager} onDone={refresh}/> : tab === 'incidents' ? <IncidentCard key={record.incident_id} record={record} manager={manager} onDone={refresh}/> : <RefundCard key={record.refund_id} record={record} manager={manager} onDone={refresh}/>)}
    <Pager page={page} totalPages={result.data?.total_pages} onChange={setPage}/>
  </OperationsLayout>;
}
