import { useCallback, useEffect, useState } from 'react';
import Icon from '../../bookings/components/BookingIcon';
import { bookingCode, dateTime } from '../../bookings/bookingConstants';
import { driverTripAction, getDriverWorkflow, reportTripIncident, workflowError } from '../api/tripWorkflowApi';
import DriverVehicleHandover from './DriverVehicleHandover';

const labels = { awaiting_driver: 'Chờ bạn phản hồi phân công', awaiting_vehicle: 'Chờ Gara kiểm tra và bàn giao xe', to_pickup: 'Đang tới điểm đón', at_pickup: 'Đã đến điểm đón', outbound: 'Đang phục vụ lượt đi', tour: 'Đang đồng hành tham quan', return_waiting: 'Chờ giờ đón khách lượt về', return: 'Đang đưa khách về', awaiting_report: 'Xác nhận trả khách và gửi báo cáo', awaiting_vehicle_return: 'Chờ Gara tiếp nhận xe', completed: 'Hoàn tất chuyến', reassignment_required: 'Đã từ chối, chờ Operator phân công lại', vehicle_replacement_required: 'Báo xe hỏng, chờ Operator đổi xe', incident_open: 'Đã báo sự cố, chờ hỗ trợ', vehicle_return_issue: 'Gara ghi nhận xe cần xử lý', return_reassignment_required: 'Chờ Operator bố trí tài xế lượt về', routed_to_booking_changes: 'Đã chuyển Operator xử lý đổi lịch trình' };

export default function DriverWorkflowPanel() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  const load = useCallback(async () => { try { setItems(await getDriverWorkflow()); setError(''); } catch (failure) { setError(workflowError(failure)); } }, []);
  useEffect(() => { load(); const timer = window.setInterval(load, 30000); const clockTimer = window.setInterval(() => setClock(Date.now()), 30000); return () => { window.clearInterval(timer); window.clearInterval(clockTimer); }; }, [load]);
  async function perform(id, action, body) { setBusy(`${id}-${action}`); setError(''); try { await driverTripAction(id, action, body); await load(); } catch (failure) { setError(workflowError(failure)); } finally { setBusy(''); } }
  async function reject(item) { const reason = window.prompt('Lý do từ chối phân công:'); if (reason?.trim()) await perform(item.workflow.booking_id, 'reject', { reason }); }
  async function update(item, kind, extra = {}) { await perform(item.workflow.booking_id, 'update', { kind, ...extra }); }
  async function delay(item) { const reason = window.prompt('Lý do chậm:'); if (!reason?.trim()) return; const minutes = window.prompt('Chậm bao nhiêu phút?'); if (minutes) await update(item, 'delayed', { reason, minutes: Number(minutes) }); }
  async function report(item) { const km = window.prompt('Số km cuối:'); if (km === null) return; const summary = window.prompt('Báo cáo sau chuyến (tình trạng khách/xe, phát sinh):'); if (summary?.trim()) await perform(item.workflow.booking_id, 'report', { end_odometer: Number(km), summary }); }
  async function incident(item, kind) { const promptText = kind === 'vehicle_failure' ? 'Mô tả hỏng xe và vị trí hiện tại:' : kind === 'customer_route_change' ? 'Khách muốn đổi điểm dừng nào? Ghi rõ điểm hiện tại và điểm khách muốn đổi sang:' : 'Mô tả sự cố và hỗ trợ cần thiết:'; const description = window.prompt(promptText); if (description?.trim()) { setBusy(`incident-${item.workflow.booking_id}`); setError(''); try { await reportTripIncident(item.workflow.booking_id, { kind, description: description.trim() }); await load(); } catch (failure) { setError(workflowError(failure)); } finally { setBusy(''); } } }
  return <section className="workflow-driver-section" id="driver-workflow"><div className="workflow-section-heading"><div><span className="section-eyebrow">THỰC HIỆN CHUYẾN</span><h2>Phân công và cập nhật hành trình</h2></div><button className="dispatch-button subtle" onClick={load}><Icon name="refresh" size={14} /> Làm mới</button></div>
    {error && <div className="dispatch-alert" role="alert">{error}</div>}
    {items.length === 0 ? <p className="workflow-muted">Chưa có phân công cần thao tác.</p> : <div className="workflow-driver-list">{items.map((item) => { const w = item.workflow; const b = item.booking; const id = w.booking_id; const waiting = busy.startsWith(`${id}-`) || busy === `incident-${id}`; return <article className="workflow-driver-card" key={id}>
      <div className="workflow-driver-card-head"><div><span>{bookingCode(id)} · {w.service_type === 'tour' ? 'Tham quan' : w.service_type === 'round_trip' ? 'Đưa đi – đón về' : 'Một chiều'}</span><h3>{labels[w.stage] || w.stage}</h3></div><span className={`workflow-stage stage-${w.stage}`}>{w.driver_response === 'pending' ? 'Cần phản hồi' : w.stage}</span></div>
      <p>{b?.pickup_location} → {b?.dropoff_location} · {dateTime(b?.pickup_time)}</p>
      {w.service_type === 'round_trip' && <p>Đón về: {w.return_pickup_location} · {dateTime(w.return_pickup_time)}</p>}
      {item.stops?.length > 0 && <ol className="workflow-stop-list">{item.stops.map((stop) => <li key={stop.stop_id} className={w.completed_stops?.includes(stop.stop_id) ? 'is-done' : ''}><span>{stop.location}</span>{w.stage === 'tour' && !w.completed_stops?.includes(stop.stop_id) && <button disabled={waiting || item.stops.some((s) => s.stop_order < stop.stop_order && !w.completed_stops?.includes(s.stop_id))} onClick={() => update(item, 'stop_completed', { stop_id: stop.stop_id })}>Hoàn thành điểm</button>}</li>)}</ol>}
      {w.delay_minutes > 0 && <p className="workflow-muted">Chậm {w.delay_minutes} phút · {w.delay_reason}</p>}
      <div className="workflow-actions">
        {w.driver_response === 'pending' && <><button disabled={waiting} onClick={() => perform(id, 'accept')}>Chấp nhận chuyến</button><button className="workflow-danger" disabled={waiting} onClick={() => reject(item)}>Từ chối có lý do</button></>}
        {['to_pickup','at_pickup'].includes(w.stage) && <>{w.stage === 'to_pickup' && <button disabled={waiting} onClick={() => update(item, 'arrived_pickup')}>Đã đến điểm đón</button>}<button disabled={waiting} onClick={() => update(item, 'picked_up')}>Đã đón khách</button></>}
        {w.stage === 'outbound' && <><button disabled={waiting} onClick={() => update(item, 'outbound_completed')}>Hoàn thành lượt đi</button><button className="workflow-secondary" disabled={waiting} onClick={() => delay(item)}>Báo chậm</button></>}
        {w.stage === 'return_waiting' && <><button disabled={waiting} onClick={() => update(item, 'return_pickup')}>Đã đón khách lượt về</button><button className="workflow-secondary" disabled={waiting} onClick={() => { const reason = window.prompt('Vì sao không thể thực hiện lượt về?'); if (reason?.trim()) update(item, 'return_unavailable', { reason }); }}>Không thể đi lượt về</button></>}
        {w.stage === 'return' && <><button disabled={waiting} onClick={() => update(item, 'return_completed')}>Hoàn thành lượt về</button><button className="workflow-secondary" disabled={waiting} onClick={() => delay(item)}>Báo chậm</button></>}
        {w.stage === 'awaiting_report' && <button disabled={waiting} onClick={() => report(item)}>Xác nhận trả khách & gửi báo cáo</button>}
        {['awaiting_vehicle_return', 'vehicle_return_issue'].includes(w.stage) && (
          <button disabled={waiting || w.return_inspection_id === null} onClick={() => perform(id, 'vehicle_returned')}>
            Xác nhận trả xe cho Gara
          </button>
        )}
        {!['completed','reassignment_required','routed_to_booking_changes'].includes(w.stage) && <><button className="workflow-secondary" disabled={waiting} onClick={() => incident(item, 'other')}>Báo sự cố / yêu cầu hỗ trợ</button><button className="workflow-secondary" disabled={waiting} onClick={() => incident(item, 'customer_route_change')}>Khách đổi điểm dừng</button><button className="workflow-danger" disabled={waiting} onClick={() => incident(item, 'vehicle_failure')}>Báo xe hỏng</button></>}
      </div>
      {(w.stage === 'awaiting_vehicle' || item.handover?.status === 'accepted') && (
        <DriverVehicleHandover key={item.handover?.inspection_id || 'waiting'} item={item} clock={clock} busy={waiting}
          onAction={(action, input) => perform(id, action, input)}
        />
      )}
      {w.stage === 'awaiting_vehicle_return' && w.return_inspection_id == null && (
        <small className="workflow-muted">Gara cần ghi nhận tiếp nhận xe trước khi bạn xác nhận trả xe.</small>
      )}
      {w.history?.length > 0 && <details className="workflow-history"><summary>Lịch sử xử lý ({w.history.length})</summary><ol>{[...w.history].reverse().map((event, i) => <li key={`${event.action}-${i}`}>{event.action.replaceAll('_',' ')} · {dateTime(event.created_at)}{event.note ? ` · ${event.note}` : ''}</li>)}</ol></details>}
    </article>; })}</div>}
  </section>;
}
