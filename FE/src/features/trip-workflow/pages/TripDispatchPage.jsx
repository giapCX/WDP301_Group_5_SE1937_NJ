import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import BookingSidebar from '../../bookings/components/BookingSidebar';
import Icon from '../../bookings/components/BookingIcon';
import { bookingCode, dateTime } from '../../bookings/bookingConstants';
import {
  assignTrip, getDispatchData, reassignReturnDriver, replaceTripVehicle,
  resolveTripIncident, workflowError,
} from '../api/tripWorkflowApi';
import '../../bookings/styles/bookings.css';
import '../styles/workflow.css';

const stageNames = {
  awaiting_driver: 'Chờ tài xế phản hồi', awaiting_vehicle: 'Chờ Gara bàn giao xe',
  to_pickup: 'Đang tới điểm đón', at_pickup: 'Đã tới điểm đón', outbound: 'Đang phục vụ',
  tour: 'Đang tham quan', return_waiting: 'Chờ lượt về', return: 'Đang đưa khách về',
  awaiting_report: 'Chờ báo cáo', awaiting_vehicle_return: 'Chờ Gara nhận xe',
  completed: 'Hoàn thành', reassignment_required: 'Cần phân công lại',
  vehicle_replacement_required: 'Cần đổi xe', incident_open: 'Có sự cố cần hỗ trợ',
  return_reassignment_required: 'Cần thay tài xế lượt về',
  routed_to_booking_changes: 'Đã chuyển luồng thay đổi lịch trình',
  vehicle_return_issue: 'Xe cần kiểm tra',
};

export default function TripDispatchPage() {
  const user = useOutletContext();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [serviceType, setServiceType] = useState('one_way');
  const [returnTime, setReturnTime] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setData(await getDispatchData()); setError(''); }
    catch (failure) { setError(workflowError(failure)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const row = data?.bookings.find(({ booking }) => booking.booking_id === Number(selected));

  function chooseBooking(id) {
    const match = data?.bookings.find(({ booking }) => booking.booking_id === Number(id));
    setSelected(id);
    setDriverId(match?.workflow?.stage === 'return_reassignment_required' ? '' : String(match?.workflow?.driver_id || ''));
    setVehicleId(match?.workflow?.stage === 'vehicle_replacement_required' ? '' : String(match?.workflow?.vehicle_id || match?.booking.vehicle_id || ''));
    setServiceType(match?.workflow?.service_type || 'one_way');
    setReturnTime(match?.workflow?.return_pickup_time ? new Date(match.workflow.return_pickup_time).toISOString().slice(0, 16) : '');
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (row.workflow?.stage === 'vehicle_replacement_required') await replaceTripVehicle(selected, Number(vehicleId));
      else if (row.workflow?.stage === 'return_reassignment_required') await reassignReturnDriver(selected, Number(driverId));
      else await assignTrip(selected, {
        driver_id: Number(driverId), vehicle_id: Number(vehicleId), service_type: serviceType,
        return_pickup_time: returnTime ? new Date(returnTime).toISOString() : undefined,
      });
      setSelected(''); setDriverId(''); setVehicleId(''); await load();
    } catch (failure) { setError(workflowError(failure)); }
    finally { setBusy(false); }
  }

  async function resolveIncident(incident) {
    const note = window.prompt('Biện pháp xử lý sự cố:');
    if (!note?.trim()) return;
    setBusy(true); setError('');
    try { await resolveTripIncident(incident.booking_id, incident.incident_id, note); await load(); }
    catch (failure) { setError(workflowError(failure)); }
    finally { setBusy(false); }
  }

  return <div className="dispatch-app"><BookingSidebar /><div className="dispatch-workspace">
    <header className="dispatch-topbar"><div className="dispatch-breadcrumb">Trang chủ <Icon name="chevron" size={11} /> Điều hành <Icon name="chevron" size={11} /><strong>Phân công chuyến</strong></div><div className="operator-profile"><span className="profile-avatar"><Icon name="user" size={18} /></span><span><strong>{user?.full_name || 'Operator Staff'}</strong><small>Trung tâm điều hành</small></span></div></header>
    <main className="dispatch-content">
      <section className="dispatch-page-heading"><div><div className="heading-kicker"><span>ĐIỀU PHỐI ĐỘI XE</span><i />Kiểm tra lịch tài xế và phương tiện</div><h1>Phân công và thực hiện chuyến</h1><p>Chọn booking đã xác nhận. Hệ thống kiểm tra lịch xe, bảo dưỡng, hồ sơ và lịch tài xế.</p></div><button className="dispatch-button primary" onClick={load}><Icon name="refresh" size={16} />Làm mới</button></section>
      {error && <div className="dispatch-alert" role="alert">{error}</div>}
      {data?.bookings.some(({ workflow }) => workflow?.stage === 'routed_to_booking_changes') && <div className="workflow-route-notice">Có chuyến cần xử lý đổi điểm dừng. <Link to="/operator/booking-change-requests">Mở luồng thay đổi lịch trình</Link>.</div>}
      <section className="workflow-assign-card"><h2>Điều phối booking</h2>
        <label>Booking đã xác nhận<select value={selected} onChange={(e) => chooseBooking(e.target.value)}><option value="">Chọn booking</option>{data?.bookings.map(({ booking }) => <option key={booking.booking_id} value={booking.booking_id}>{bookingCode(booking.booking_id)} · {booking.renter?.full_name || 'Khách'} · {dateTime(booking.pickup_time)}</option>)}</select></label>
        {row && (row.booking.booking_status === 'confirmed' || ['reassignment_required', 'vehicle_replacement_required', 'return_reassignment_required'].includes(row.workflow?.stage)) && <form onSubmit={submit} className="workflow-form"><div className="workflow-form-grid">
          {row.workflow?.stage !== 'vehicle_replacement_required' && <label>{row.workflow?.stage === 'return_reassignment_required' ? 'Tài xế thay thế lượt về' : 'Tài xế'}<select required value={driverId} onChange={(e) => setDriverId(e.target.value)}><option value="">Chọn tài xế</option>{data.drivers.map((driver) => <option key={driver.driver_id} value={driver.driver_id} disabled={driver.status !== 'active' || !['available', 'busy'].includes(driver.availability_status) || !driver.approved}>{driver.full_name} · {driver.availability_status}{!driver.approved ? ' · chưa duyệt' : ''}</option>)}</select></label>}
          {row.workflow?.stage !== 'return_reassignment_required' && <label>{row.workflow?.stage === 'vehicle_replacement_required' ? 'Xe thay thế' : 'Xe'}<select required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}><option value="">Chọn phương tiện</option>{data.vehicles.map((vehicle) => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id} disabled={!['available', 'in_use'].includes(vehicle.status)}>{vehicle.plate_number} · {vehicle.brand} {vehicle.model} · {vehicle.status}</option>)}</select></label>}
          {!row.workflow && <><label>Loại dịch vụ<select value={serviceType} onChange={(e) => setServiceType(e.target.value)}><option value="one_way">Đưa khách một chiều</option><option value="round_trip">Đưa đi – đón về</option><option value="tour">Đồng hành tham quan</option></select></label>{serviceType === 'round_trip' && <label>Giờ đón lượt về<input required type="datetime-local" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} /></label>}</>}
        </div><p className="workflow-route">{row.booking.pickup_location} → {row.booking.dropoff_location} · {dateTime(row.booking.pickup_time)} – {dateTime(row.booking.estimated_end_time)}</p><button className="dispatch-button primary" disabled={busy || (row.workflow?.stage !== 'vehicle_replacement_required' && !driverId) || (row.workflow?.stage !== 'return_reassignment_required' && !vehicleId)}>{busy ? 'Đang xử lý…' : row.workflow?.stage === 'vehicle_replacement_required' ? 'Điều phối xe thay thế' : row.workflow?.stage === 'return_reassignment_required' ? 'Giao lượt về cho tài xế khác' : row.workflow ? 'Phân công lại chuyến' : 'Gửi phân công cho tài xế'}</button></form>}
        {row && !(row.booking.booking_status === 'confirmed' || ['reassignment_required', 'vehicle_replacement_required', 'return_reassignment_required'].includes(row.workflow?.stage)) && <p className="workflow-muted">Chuyến đang được thực hiện. Dùng <Link to="/operator/trip-monitoring">Theo dõi chuyến</Link> để xem tiến độ.</p>}
      </section>
      <section className="booking-list-panel"><div className="section-heading table-heading"><h2><Icon name="route" />Lịch sử điều phối</h2><span>{data?.bookings.length || 0} chuyến</span></div><div className="workflow-table-wrap"><table className="workflow-table"><thead><tr><th>Booking</th><th>Khách / lịch</th><th>Xe</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>{data?.bookings.map(({ booking, assignment, workflow }) => <tr key={booking.booking_id}><td>{bookingCode(booking.booking_id)}<small>{booking.booking_status}</small></td><td>{booking.renter?.full_name || 'Khách'}<small>{dateTime(booking.pickup_time)}</small></td><td>{booking.vehicle?.plate_number || 'Chưa gán'}</td><td>{stageNames[workflow?.stage] || (assignment ? assignment.assignment_status : 'Chưa phân công')}<small>{workflow?.service_type || ''}</small></td><td><button className="workflow-link" onClick={() => chooseBooking(String(booking.booking_id))}>Chi tiết / điều phối</button></td></tr>)}</tbody></table>{!data?.bookings.length && <div className="dispatch-empty">Chưa có booking đã xác nhận cần điều phối.</div>}</div></section>
      {data?.incidents?.length > 0 && <section className="workflow-assign-card"><h2>Sự cố cần xử lý</h2>{data.incidents.map((incident) => <div key={incident.incident_id} className="workflow-incident"><span>{bookingCode(incident.booking_id)} · {incident.description}</span>{incident.workflow_stage === 'routed_to_booking_changes' ? <Link to="/operator/booking-change-requests">Mở luồng 4</Link> : incident.workflow_stage === 'vehicle_replacement_required' ? <button onClick={() => chooseBooking(String(incident.booking_id))}>Điều phối xe thay thế</button> : <button disabled={busy} onClick={() => resolveIncident(incident)}>Ghi nhận xử lý</button>}</div>)}</section>}
    </main></div></div>;
}
