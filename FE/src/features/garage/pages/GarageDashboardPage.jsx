import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Icon from '../../bookings/components/BookingIcon';
import { DispatchSidebar } from '../../bookings/components/BookingSidebar';
import { DispatchStats } from '../../bookings/components/BookingStats';
import { bookingCode, dateTime } from '../../bookings/bookingConstants';
import SignOutButton from '../../auth/components/SignOutButton';
import { garageError, getGarageTasks, submitGarageInspection, updateGarageMaintenance } from '../api/garageApi';
import GaragePreTripInspection from '../components/GaragePreTripInspection';
import '../../bookings/styles/bookings.css';
import '../styles/garage.css';
import '../../trip-workflow/styles/workflow.css';

const TASK_TYPES = { ALL: 'Tất cả', HANDOVER_OUT: 'Kiểm tra trước chuyến', RETURN_IN: 'Tiếp nhận xe', MAINTENANCE: 'Bảo dưỡng' };
const STATUS = {
  pending: { label: 'Chờ thực hiện', tone: 'red' },
  in_progress: { label: 'Đang thực hiện', tone: 'purple' },
  completed: { label: 'Đã hoàn thành', tone: 'teal' },
  failed: { label: 'Không đạt', tone: 'red' },
};

function taskKey(task) {
  return task.id + ':' + task.vehicle_id;
}

function handoverStatus(task) {
  if (task.workflow_stage === 'awaiting_driver') return 'Chờ tài xế nhận phân công';
  if (task.status === 'failed') return 'Chờ Operator đổi xe';
  if (task.status === 'completed') return 'Chờ tài xế nhận xe';
  return 'Chờ Gara kiểm tra xe';
}

export default function GarageDashboardPage() {
  const user = useOutletContext();
  const [date, setDate] = useState('');
  const [type, setType] = useState('ALL');
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [forms, setForms] = useState({});
  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    getGarageTasks(date, request.signal).then((items) => {
      if (request.signal.aborted) return;
      setTasks(items);
      setError('');
    }).catch((failure) => {
      if (!request.signal.aborted) setError(garageError(failure));
    }).finally(() => {
      if (!request.signal.aborted) setLoading(false);
    });
    return () => request.abort();
  }, [date, revision]);
  const selectedTask = tasks.find((task) => taskKey(task) === selected);
  const search = query.trim().toLocaleLowerCase('vi');
  const visible = useMemo(() => tasks.filter((task) => {
    const searchable = [task.id, task.vehicle?.brand, task.vehicle?.model, task.vehicle?.plate_number, task.booking_id, task.driver?.full_name, task.maintenance?.description].join(' ').toLocaleLowerCase('vi');
    return (type === 'ALL' || task.type === type) && searchable.includes(search);
  }), [tasks, type, search]);
  const cards = [
    { label: 'Tổng nhiệm vụ', value: tasks.length, icon: 'list', tone: 'blue' },
    ...Object.entries(STATUS).map(([status, item]) => ({ label: item.label, value: tasks.filter((task) => task.status === status).length, icon: status === 'completed' ? 'check' : status === 'in_progress' ? 'route' : 'clock', tone: item.tone })),
  ];

  function load() {
    setRevision((value) => value + 1);
  }

  async function savePreTrip(task, details) {
    setBusy(task.id);
    setError('');
    try {
      const { inspection, workflow } = await submitGarageInspection({
        ...details, booking_id: task.booking_id, vehicle_id: task.vehicle_id, inspection_type: 'handover',
      });
      setTasks((items) => items.map((item) => taskKey(item) === taskKey(task) ? {
        ...item,
        inspection,
        status: inspection.result === 'passed' ? 'completed' : 'failed',
        workflow_stage: workflow.stage,
      } : item));
      load();
    } catch (failure) {
      if (failure.response?.status === 409) load();
      throw failure;
    } finally {
      setBusy('');
    }
  }

  function setForm(id, key, value) { setForms((current) => ({ ...current, [id]: { ...(current[id] || {}), [key]: value } })); }
  async function inspect(task, result) {
    const form = forms[task.id] || {};
    if (!form.condition_note?.trim()) { setError('Vui lòng nhập tình trạng xe / nội dung kiểm tra.'); return; }
    if (form.odometer === '' || form.odometer == null || !Number.isFinite(Number(form.odometer))) { setError('Vui lòng ghi số km trên đồng hồ.'); return; }
    setBusy(task.id); setError('');
    try {
      await submitGarageInspection({ booking_id: task.booking_id ?? null, vehicle_id: task.vehicle_id, inspection_type: task.inspection_type || 'periodic', result, condition_note: form.condition_note.trim(), odometer: Number(form.odometer) });
      setForms((current) => ({ ...current, [task.id]: { ...current[task.id], open: false, condition_note: '', odometer: '' } }));
      load();
    } catch (failure) { setError(garageError(failure)); }
    finally { setBusy(''); }
  }
  async function maintenance(task, status) {
    setBusy(task.id); setError('');
    try { await updateGarageMaintenance(task.maintenance.maintenance_id, status); load(); }
    catch (failure) { setError(garageError(failure)); }
    finally { setBusy(''); }
  }
  function reset() { setDate(''); setType('ALL'); setQuery(''); setSelected(null); }

  return <div className="dispatch-app garage-dashboard" id="garage-overview">
    <DispatchSidebar home="/garage/tasks" caption="NHÂN VIÊN GARA" navigationLabel="Điều hướng gara" footer={<div className="sidebar-workspace"><span className="workspace-dot" />Không gian Gara<span>V1.0</span></div>}>
      <a href="#garage-overview" className="active"><Icon name="grid" />Tổng quan</a>
      <a href="#garage-task-list"><Icon name="list" />Danh sách nhiệm vụ</a>
    </DispatchSidebar>
    <div className="dispatch-workspace">
      <header className="dispatch-topbar"><div className="dispatch-breadcrumb">Gara <Icon name="chevron" size={11} /><strong>Tổng quan</strong></div><div className="garage-user-actions"><div className="operator-profile"><span className="profile-avatar"><Icon name="user" /></span><span><strong>{user?.full_name || 'Garage Staff'}</strong><small>Nhân viên Gara</small></span></div><SignOutButton /></div></header>
      <main className="dispatch-content">
        <header className="dispatch-page-heading"><div><span className="garage-live-label">NHIỆM VỤ TỪ HỆ THỐNG</span><h1>Nhiệm vụ gara</h1><p>Kiểm tra trước chuyến, bàn giao cho tài xế và tiếp nhận xe sau hành trình.</p></div><div className="garage-page-actions"><button className="dispatch-button subtle" onClick={load} disabled={Boolean(busy)}><Icon name="refresh" size={15} />Làm mới</button><label className="garage-date">Lọc theo ngày<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><small>{date ? 'Đang lọc ngày đã chọn' : 'Đang hiển thị mọi nhiệm vụ đang chờ'}</small></label></div></header>
        <DispatchStats cards={cards} label="Thống kê nhiệm vụ Gara" />
        {error && <div className="dispatch-alert" role="alert">{error}</div>}
        {selectedTask && (
          <GaragePreTripInspection
            key={selected}
            task={selectedTask}
            onSave={savePreTrip}
            onClose={() => setSelected(null)}
            busy={Boolean(busy) || loading}
          />
        )}
        <section className="dispatch-filters" aria-label="Lọc nhiệm vụ gara"><div className="booking-tabs" role="group" aria-label="Loại nhiệm vụ">{Object.entries(TASK_TYPES).map(([key, label]) => <button key={key} className={type === key ? 'is-active' : ''} aria-pressed={type === key} onClick={() => setType(key)}>{label}</button>)}</div><div className="booking-filter-fields"><label className="booking-search"><Icon name="search" size={17} /><input aria-label="Tìm nhiệm vụ gara" placeholder="Tìm booking, xe, biển số hoặc tài xế…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{query && <button className="dispatch-button subtle compact" onClick={() => setQuery('')}>Xóa tìm kiếm</button>}</div></section>
        <section className="booking-list-panel" id="garage-task-list" aria-labelledby="garage-list-heading"><div className="section-heading table-heading"><h2 id="garage-list-heading"><Icon name="list" />Nhiệm vụ được giao</h2><span role="status">{visible.length} / {tasks.length} nhiệm vụ</span></div>
          {loading && <p className="garage-task-loading" role="status">Đang tải nhiệm vụ Gara…</p>}
          {!visible.length ? !loading && <div className="dispatch-empty"><Icon name="calendar" size={30} /><h3>Không có nhiệm vụ phù hợp</h3><button className="dispatch-button subtle" onClick={reset}>Đặt lại bộ lọc</button></div> : <div className="booking-table-scroll" role="region" aria-label="Bảng nhiệm vụ gara" tabIndex={0}><table className="booking-table garage-table"><thead><tr><th>Xe / booking</th><th>Loại nhiệm vụ</th><th>Lịch / tài xế</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visible.map((task) => {
            const form = forms[task.id] || {};
            const preTrip = task.type === 'HANDOVER_OUT';
            const canInspect = task.type === 'RETURN_IN' && task.status !== 'completed';
            const latest = task.latest_inspection;
            const canFinishMaintenance = task.type === 'MAINTENANCE' && latest && ['passed', 'pass'].includes(latest.result) && new Date(latest.inspected_at) >= new Date(task.maintenance.started_at || 0);
            const status = STATUS[task.status] || STATUS.pending;
            return <tr key={taskKey(task)}>
              <td>
                <div className="garage-vehicle">
                  <span className="garage-vehicle-icon"><Icon name="car" /></span>
                  <div>
                    <strong>{task.vehicle?.brand} {task.vehicle?.model}</strong>
                    <small>{task.vehicle?.plate_number} · {task.booking_id ? bookingCode(task.booking_id) : task.id}</small>
                  </div>
                </div>
                {task.inspection?.condition_note && <small className="garage-inspection-note">Lần kiểm tra gần nhất: {task.inspection.condition_note}</small>}
              </td>
              <td>{TASK_TYPES[task.type]}</td>
              <td>
                {task.due_at ? dateTime(task.due_at) : 'Đang bảo dưỡng'}
                {task.driver?.full_name && <small className="garage-subline">Tài xế {task.driver.full_name}</small>}
                {task.booking && <small className="garage-subline">{task.booking.pickup_location} → {task.booking.dropoff_location}</small>}
              </td>
              <td>
                <span className={`booking-status tone-${status.tone}`}><i />{status.label}</span>
                {preTrip && <small className="garage-subline">{handoverStatus(task)}</small>}
                {task.vehicle?.status && <small className="garage-subline">Xe: {task.vehicle.status}</small>}
              </td>
              <td className="garage-task-actions">
              {preTrip && (
                <button
                  type="button"
                  className="dispatch-button primary compact"
                  onClick={() => setSelected(taskKey(task))}
                  disabled={Boolean(busy)}
                >
                  {task.inspection ? 'Xem hồ sơ' : task.workflow_stage === 'awaiting_driver' ? 'Xem nhiệm vụ' : 'Mở checklist'}
                </button>
              )}
              {canInspect && (form.open ? <div className="garage-inspection-form"><label>Tình trạng / checklist<textarea rows={2} maxLength={1000} value={form.condition_note || ''} onChange={(e) => setForm(task.id, 'condition_note', e.target.value)} placeholder="Lốp, phanh, đèn, nhiên liệu, hiện trạng…" /></label><label>ODO<input type="number" min="0" step="0.1" value={form.odometer ?? ''} onChange={(e) => setForm(task.id, 'odometer', e.target.value)} /></label><div><button disabled={busy === task.id} onClick={() => inspect(task, 'passed')}>Đạt, tiếp nhận xe</button><button className="garage-fail-button" disabled={busy === task.id} onClick={() => inspect(task, 'failed')}>Không đạt</button><button className="garage-cancel-button" onClick={() => setForm(task.id, 'open', false)}>Hủy</button></div></div> : <button className="dispatch-button primary compact" onClick={() => { setForm(task.id, 'open', true); setForm(task.id, 'condition_note', ''); setForm(task.id, 'odometer', ''); }}>Kiểm tra &amp; nhận xe</button>)}
              {task.type === 'MAINTENANCE' && (form.open ? <div className="garage-inspection-form"><label>Kết quả kiểm tra sau sửa chữa<textarea rows={2} maxLength={1000} value={form.condition_note || ''} onChange={(e) => setForm(task.id, 'condition_note', e.target.value)} placeholder="Ghi các hạng mục đã kiểm tra…" /></label><label>ODO<input type="number" min="0" step="0.1" value={form.odometer ?? ''} onChange={(e) => setForm(task.id, 'odometer', e.target.value)} /></label><div><button disabled={busy === task.id} onClick={() => inspect(task, 'passed')}>Ghi nhận đạt</button><button className="garage-fail-button" disabled={busy === task.id} onClick={() => inspect(task, 'failed')}>Còn lỗi</button><button className="garage-cancel-button" onClick={() => setForm(task.id, 'open', false)}>Hủy</button></div></div> : <div className="garage-maintenance-actions"><button className="dispatch-button subtle compact" onClick={() => { setForm(task.id, 'open', true); setForm(task.id, 'condition_note', ''); setForm(task.id, 'odometer', ''); }}>Kiểm tra sau sửa chữa</button>{canFinishMaintenance && <button className="dispatch-button primary compact" disabled={busy === task.id} onClick={() => maintenance(task, 'completed')}>Đưa xe về sẵn sàng</button>}</div>)}
            </td></tr>;
          })}</tbody></table></div>}
        </section>
      </main>
    </div>
  </div>;
}
