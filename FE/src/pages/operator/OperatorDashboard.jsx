import { useCallback, useEffect, useMemo, useState } from 'react';
import './operator-dashboard.css';

const STATUS = {
  pending: ['Chờ xử lý', 'pending'], confirmed: ['Đã xác nhận', 'confirmed'],
  in_progress: ['Đang thuê', 'progress'], completed: ['Hoàn tất', 'completed'],
  cancelled: ['Đã hủy', 'cancelled'], rejected: ['Đã từ chối', 'rejected'],
};
const FILTERS = [['all', 'Tất cả'], ['pending', 'Chờ xử lý'], ['confirmed', 'Đã xác nhận'], ['in_progress', 'Đang thuê'], ['completed', 'Hoàn tất'], ['rejected', 'Từ chối']];
const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
const date = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

async function api(path, options) {
  const response = await fetch(`/api/operator${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || 'Không thể kết nối máy chủ.');
  return payload.data;
}

function Icon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    car: <><path d="m5 11 1.4-4.2A2 2 0 0 1 8.3 5.5h7.4a2 2 0 0 1 1.9 1.3L19 11"/><path d="M3.5 11.5h17v6h-17zM6.5 17.5v2m11-2v2M6 14.5h.01M18 14.5h.01"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6.5L20 12M4 12l2 5.5A7 7 0 0 0 18.4 15"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
  };
  return <svg className="op-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function OperatorDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [vehicleId, setVehicleId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [metrics, bookings] = await Promise.all([
        api('/dashboard'), api(`/bookings?status=${filter}&q=${encodeURIComponent(search)}&limit=100`),
      ]);
      setDashboard(metrics); setItems(bookings.items || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [filter, search]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); }, [toast]);

  const pendingCount = dashboard?.pendingBookings || 0;
  const stats = useMemo(() => [
    { label: 'Tổng đơn thuê', value: dashboard?.totalBookings ?? '—', note: 'Đơn ghi nhận trong hệ thống', icon: 'grid', color: 'blue' },
    { label: 'Chờ duyệt', value: pendingCount, note: 'Cần operator xử lý', icon: 'clock', color: 'amber' },
    { label: 'Chuyến đang chạy', value: dashboard?.activeTrips ?? '—', note: 'Đang được khách sử dụng', icon: 'car', color: 'violet' },
    { label: 'Xe sẵn sàng', value: dashboard?.availableVehicles ?? '—', note: 'Có thể điều phối ngay', icon: 'check', color: 'green' },
  ], [dashboard, pendingCount]);

  async function openBooking(booking) {
    setSelected(booking); setVehicleId(''); setRejectReason(''); setVehicles([]);
    if (booking.booking_status === 'pending') {
      try { const result = await api(`/bookings/${booking.booking_id}/available-vehicles`); setVehicles(result.vehicles || []); }
      catch (err) { setToast(err.message); }
    }
  }
  async function act(action) {
    if (!selected) return;
    setSaving(true);
    try {
      const body = action === 'approve' ? { vehicle_id: Number(vehicleId) } : { rejection_reason: rejectReason };
      await api(`/bookings/${selected.booking_id}/${action}`, { method: 'PATCH', body: JSON.stringify(body) });
      setSelected(null); setToast(action === 'approve' ? 'Đã xác nhận booking và điều phối xe.' : 'Đã từ chối booking.'); await load();
    } catch (err) { setToast(err.message); }
    finally { setSaving(false); }
  }

  return <main className="operator-shell">
    <aside className="op-sidebar">
      <div className="op-brand"><span className="op-brand-mark"><Icon name="car" /></span><span><b>Điều hành</b><small>CAR RENTAL OPS</small></span></div>
      <div className="op-nav-label">KHÔNG GIAN LÀM VIỆC</div>
      <div className="op-nav-item active"><Icon name="grid"/><span>Tổng quan</span></div>
      <div className="op-nav-item" onClick={() => { setFilter('all'); document.getElementById('booking-list')?.scrollIntoView({ behavior: 'smooth' }); }}><Icon name="car"/><span>Đơn thuê xe</span><span className="op-nav-count">{pendingCount}</span></div>
      <div className="op-sidebar-bottom"><span className="op-live-dot"/> Kết nối database sample <b>Online</b><small>Operator workspace</small></div>
    </aside>
    <section className="op-main">
      <header className="op-header"><div><div className="op-breadcrumb">Vận hành <span>/</span> Tổng quan</div><h1>Trung tâm điều hành</h1><p>Theo dõi đơn thuê và xử lý yêu cầu điều phối xe.</p></div><div className="op-header-actions"><span className="op-date">{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span><button className="op-refresh" onClick={load} title="Làm mới"><Icon name="refresh"/></button><span className="op-avatar">OP</span></div></header>
      {error && <div className="op-error"><b>Không tải được dữ liệu</b><span>{error}</span><button onClick={load}>Thử lại</button></div>}
      <div className="op-section-heading"><div><h2>Tổng quan hoạt động</h2><p>Số liệu được lấy trực tiếp từ database.</p></div><span className="op-updated"><i/> Đang đồng bộ</span></div>
      <div className="op-stats">{stats.map((stat) => <article className="op-stat" key={stat.label}><div className={`op-stat-icon ${stat.color}`}><Icon name={stat.icon}/></div><div className="op-stat-label">{stat.label}</div><div className="op-stat-value">{loading ? <span className="op-skeleton"/> : stat.value}</div><div className="op-stat-note">{stat.note}</div></article>)}</div>
      <section className="op-bookings" id="booking-list"><div className="op-section-heading booking-heading"><div><h2>Đơn thuê xe</h2><p>Kiểm tra yêu cầu và xác nhận phương tiện phù hợp.</p></div><label className="op-search"><Icon name="search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã đơn, khách hàng, biển số..."/></label></div>
        <div className="op-tabs">{FILTERS.map(([key, label]) => <button key={key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(key)}>{label}{key === 'pending' && pendingCount > 0 && <span>{pendingCount}</span>}</button>)}</div>
        <div className="op-table-wrap"><table><thead><tr><th>MÃ ĐƠN</th><th>KHÁCH HÀNG</th><th>THỜI GIAN THUÊ</th><th>PHƯƠNG TIỆN</th><th>GIÁ TRỊ</th><th>TRẠNG THÁI</th><th/></tr></thead><tbody>
          {loading ? <tr><td colSpan="7" className="op-empty">Đang tải dữ liệu...</td></tr> : items.length ? items.map((booking) => <tr key={booking.booking_id} onClick={() => openBooking(booking)}><td><b className="op-booking-id">#{booking.booking_id}</b><small>{date(booking.created_at)}</small></td><td><b>{booking.renter?.full_name || `Khách #${booking.renter_id || '—'}`}</b><small>{booking.renter?.phone || booking.renter?.email || 'Chưa có thông tin liên hệ'}</small></td><td><b>{date(booking.pickup_time)}</b><small>đến {date(booking.estimated_end_time)}</small></td><td><b>{booking.vehicle ? `${booking.vehicle.brand || ''} ${booking.vehicle.model || ''}`.trim() : 'Chưa điều phối'}</b><small>{booking.vehicle?.plate_number || booking.pickup_location || '—'}</small></td><td><b>{money(booking.total_amount ?? booking.total_price ?? booking.estimated_price)}</b></td><td><span className={`op-status ${STATUS[booking.booking_status]?.[1] || ''}`}>{STATUS[booking.booking_status]?.[0] || booking.booking_status}</span></td><td><button className="op-row-arrow" aria-label="Xem chi tiết"><Icon name="arrow"/></button></td></tr>) : <tr><td colSpan="7" className="op-empty">{error ? 'Kiểm tra kết nối rồi thử tải lại.' : 'Không có đơn thuê phù hợp.'}</td></tr>}
        </tbody></table></div><div className="op-table-footer">Hiển thị <b>{items.length}</b> đơn thuê <span>Dữ liệu từ tourist_car_rental_demo</span></div>
      </section>
    </section>
    {selected && <div className="op-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="op-modal"><button className="op-modal-close" onClick={() => setSelected(null)}>×</button><div className="op-modal-kicker">CHI TIẾT ĐƠN THUÊ</div><h2>Booking #{selected.booking_id}</h2><span className={`op-status ${STATUS[selected.booking_status]?.[1] || ''}`}>{STATUS[selected.booking_status]?.[0] || selected.booking_status}</span><div className="op-detail-grid"><div><small>Khách hàng</small><b>{selected.renter?.full_name || `Khách #${selected.renter_id || '—'}`}</b><span>{selected.renter?.phone || selected.renter?.email || '—'}</span></div><div><small>Thời gian nhận xe</small><b>{date(selected.pickup_time)}</b><span>{selected.pickup_location || '—'}</span></div><div><small>Thời gian trả xe</small><b>{date(selected.estimated_end_time)}</b><span>{selected.dropoff_location || '—'}</span></div><div><small>Tổng giá trị</small><b>{money(selected.total_amount ?? selected.total_price ?? selected.estimated_price)}</b></div></div>
      {selected.booking_status === 'pending' && <><label className="op-field">Điều phối phương tiện<select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">Chọn xe còn trống</option>{vehicles.map((vehicle) => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.brand} {vehicle.model} · {vehicle.plate_number} · {money(vehicle.price_per_day)}/ngày</option>)}</select></label>{vehicles.length === 0 && <div className="op-no-vehicle">Chưa có xe trống phù hợp với khung giờ này.</div>}<label className="op-field">Lý do từ chối (nếu cần)<textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Nhập lý do để thông báo cho khách..." rows="2"/></label><div className="op-modal-actions"><button className="op-reject" disabled={saving || !rejectReason.trim()} onClick={() => act('reject')}>Từ chối đơn</button><button className="op-approve" disabled={saving || !vehicleId} onClick={() => act('approve')}>{saving ? 'Đang xử lý...' : 'Xác nhận & điều phối'}</button></div></>}
    </section></div>}
    {toast && <div className="op-toast">{toast}</div>}
  </main>;
}
