import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon';
import { Brand } from '../components/SiteHeader';
import { getApi, patchApi, putApi } from '../services/api';
import './ManagerPage.css';

const sections = [
  { id: 'overview', label: 'Tổng quan', icon: 'gear' },
  { id: 'vehicles', label: 'Kiểm duyệt xe', icon: 'car' },
  { id: 'incidents', label: 'Khiếu nại & sự cố', icon: 'info' },
  { id: 'policies', label: 'Chính sách nền tảng', icon: 'document' },
  { id: 'finance', label: 'Tài chính', icon: 'wallet' },
  { id: 'inspections', label: 'Báo cáo kiểm định', icon: 'check' },
  { id: 'staff', label: 'Nhân sự', icon: 'people' },
];

const formatMoney = (amount) => new Intl.NumberFormat('vi-VN').format(amount);
const formatDate = (date) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(date));
const actionText = (action, entityType) => ({
  'vehicle.approve': 'đã duyệt hồ sơ xe',
  'compensation.approve': 'đã duyệt bồi thường',
  'incident.review': 'đã xem xét sự cố',
  'policy.update': 'đã cập nhật chính sách',
}[action] || `đã cập nhật ${entityType}`);
const requestStatus = (status) => ({ submitted: 'Chờ duyệt', pending_review: 'Chờ duyệt', reported: 'Mới tiếp nhận', open: 'Mới tiếp nhận', investigating: 'Đang xem xét', awaiting_response: 'Chờ phản hồi' }[status] || status);
function revenuePath(series) {
  if (!series?.length) return '';
  const max = Math.max(1, ...series.map((item) => item.amount));
  return series.map((item, index) => {
    const x = series.length === 1 ? 350 : (index / (series.length - 1)) * 700;
    const y = 185 - (item.amount / max) * 160;
    return `${index ? 'L' : 'M'}${x},${y}`;
  }).join(' ');
}

function Metric({ icon, label, value, detail, trend, tone }) {
  return <article className="manager-metric">
    <div className="manager-metric-top"><span className={`manager-metric-icon ${tone}`}><Icon name={icon} size={19} /></span><span className="metric-trend">↗ {trend}</span></div>
    <span className="manager-metric-label">{label}</span><strong>{value}</strong><span className="manager-metric-detail">{detail}</span>
  </article>;
}

function ManagementWorkspace({ active, onNotice }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const requests = {
      vehicles: ['/manager/vehicles?status=pending'],
      incidents: ['/manager/incidents?status=open'],
      policies: ['/manager/policies'],
      staff: ['/manager/staff'],
      finance: ['/manager/reports/finance'],
      inspections: ['/manager/reports/inspections'],
    };
    const paths = requests[active] || [];
    const dateQuery = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
    if (dateQuery && ['finance', 'inspections'].includes(active)) paths[0] += `?${dateQuery}`;
    Promise.all(paths.map((path) => getApi(path, { signal: controller.signal })))
      .then((results) => setData(results.map((result) => result.data)))
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active, reload, from, to]);

  const refresh = () => setReload((value) => value + 1);
  const act = async (promise, successText) => {
    try { await promise; onNotice(successText); refresh(); }
    catch (reason) { setError(reason.message); }
  };
  const [primary] = data;

  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải dữ liệu…</p></section>;
  if (error) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{error}<button onClick={refresh}>Thử lại</button></div></section>;

  if (active === 'vehicles') return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Hồ sơ xe chờ duyệt" subtitle="Kiểm tra thông tin và cập nhật trạng thái xét duyệt." count={primary?.length || 0} />
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>XE & BIỂN SỐ</th><th>CHỦ XE</th><th>HỒ SƠ</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>{(primary || []).map((item) => <tr key={item.id}><td><strong>{item.brand} {item.model} ({item.year})</strong><span>{item.licensePlate} · {item.seats} chỗ · {item.transmission}</span></td><td>{item.owner?.full_name || '—'}<span>{item.owner?.email || ''}</span></td><td>{item.documents?.registration?.verified ? 'Đăng ký đã xác minh' : 'Chờ xác minh'}<span>{item.documents?.inspection_certificate?.verified ? 'Đăng kiểm đã xác minh' : 'Chờ đăng kiểm'}</span><span>Biên bản: {item.inspection ? `${item.inspection.recommendation} · ${item.inspection.status}` : 'Chưa có'}</span></td><td><span className="request-status amber"><i />{requestStatus(item.status)}</span></td><td><div className="workspace-actions"><button className="action-approve" disabled={!item.inspection || item.inspection.status !== 'approved' || item.inspection.recommendation !== 'pass'} title="Cần biên bản kiểm định đạt yêu cầu" onClick={() => { const note = window.prompt('Ghi chú xét duyệt (không bắt buộc):', ''); if (note !== null) act(patchApi(`/manager/vehicles/${item.id}/review`, { action: 'approve', note }), 'Đã duyệt hồ sơ xe.'); }}>Duyệt</button><button className="action-review" onClick={() => { const note = window.prompt('Nêu nội dung cần bổ sung:', ''); if (note) act(patchApi(`/manager/vehicles/${item.id}/review`, { action: 'revision', note }), 'Đã yêu cầu chủ xe bổ sung hồ sơ.'); }}>Yêu cầu bổ sung</button><button className="action-reject" onClick={() => { const note = window.prompt('Lý do từ chối hồ sơ:'); if (note) act(patchApi(`/manager/vehicles/${item.id}/review`, { action: 'reject', note }), 'Đã từ chối hồ sơ xe.'); }}>Từ chối</button></div></td></tr>)}</tbody></table>{!primary?.length && <p className="manager-empty">Không có hồ sơ xe chờ duyệt.</p>}</div>
  </section>;

  if (active === 'incidents') return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Khiếu nại & sự cố" subtitle="Xem hồ sơ đang mở và ra quyết định với yêu cầu bồi thường." count={primary?.length || 0} />
    <div className="incident-list">{(primary || []).map((item) => <article className="incident-card" key={item.id}><div className="incident-card-heading"><div><strong>{item.caseNumber} · {item.caseType}</strong><p>{item.description}</p></div><span className="request-status rose"><i />{requestStatus(item.status)}</span></div>{item.compensationClaims?.length ? item.compensationClaims.map((claim, index) => <div className="claim-row" key={`${item.id}-${index}`}><span>Yêu cầu bồi thường · {formatMoney(claim.requested_amount || 0)} ₫</span>{claim.decision ? <span className="claim-decided">{claim.decision === 'approved' ? 'Đã duyệt' : claim.decision}</span> : <div className="workspace-actions"><button className="action-approve" onClick={() => { const suggested = claim.proposed_amount ?? claim.requested_amount ?? 0; const raw = window.prompt('Số tiền bồi thường được duyệt (VND):', String(suggested)); if (raw !== null && Number.isSafeInteger(Number(raw)) && Number(raw) >= 0) act(patchApi(`/manager/incidents/${item.id}/compensation`, { decision: 'approve', amount: Number(raw), note: 'Đã xét duyệt bởi quản lý.' }), 'Đã duyệt khoản bồi thường.'); }}>Duyệt bồi thường</button><button className="action-reject" onClick={() => { const note = window.prompt('Lý do từ chối bồi thường:'); if (note) act(patchApi(`/manager/incidents/${item.id}/compensation`, { decision: 'reject', note }), 'Đã từ chối khoản bồi thường.'); }}>Từ chối</button></div>}</div>) : <div className="claim-row"><span>Chưa có yêu cầu bồi thường đang chờ. Hồ sơ sự cố vẫn cần được theo dõi.</span><button className="action-approve" onClick={() => { const note = window.prompt('Ghi chú kết luận sự cố:'); if (note) act(patchApi(`/manager/incidents/${item.id}/review`, { action: 'resolve', note }), 'Đã đóng hồ sơ sự cố.'); }}>Đóng hồ sơ</button></div>}</article>)}{!primary?.length && <p className="manager-empty">Không có khiếu nại hoặc sự cố đang mở.</p>}</div>
  </section>;

  if (active === 'policies') return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Chính sách nền tảng" subtitle="Cập nhật chính sách sẽ tạo phiên bản mới và lưu lịch sử thay đổi." count={primary?.length || 0} />
    <div className="policy-grid">{(primary || []).map((item) => <article className="policy-card" key={item.id}><div><span className="policy-type">{item.type.replaceAll('_', ' ')}</span><span className="policy-version">Phiên bản {item.version}</span></div><pre>{JSON.stringify(item.config, null, 2)}</pre><button className="action-review" onClick={() => { const raw = window.prompt('Cập nhật cấu hình JSON:', JSON.stringify(item.config, null, 2)); if (!raw) return; try { const config = JSON.parse(raw); act(putApi(`/manager/policies/${item.type}`, { config }), 'Đã tạo phiên bản chính sách mới.'); } catch { setError('Cấu hình phải là JSON hợp lệ.'); } }}>Chỉnh sửa chính sách</button></article>)}</div>
  </section>;

  if (active === 'staff') return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Quản lý nhân sự" subtitle="Thay đổi vai trò hoặc trạng thái tài khoản nhân viên." count={primary?.length || 0} />
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>NHÂN SỰ</th><th>LIÊN HỆ</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th></tr></thead><tbody>{(primary || []).map((item) => <tr key={item.id}><td><strong>{item.name}</strong><span>{item.email}</span></td><td>{item.phone || '—'}</td><td><select className="workspace-select" value={item.role} onChange={(event) => act(patchApi(`/manager/staff/${item.id}`, { role: event.target.value }), 'Đã cập nhật vai trò nhân sự.')}><option value="MANAGER">Quản lý</option><option value="OPERATION_STAFF">Nhân viên vận hành</option><option value="GARAGE_STAFF">Nhân viên gara</option></select></td><td><select className="workspace-select" value={item.status === 'active' ? 'active' : 'suspended'} onChange={(event) => act(patchApi(`/manager/staff/${item.id}`, { status: event.target.value }), 'Đã cập nhật trạng thái tài khoản.')}><option value="active">Đang hoạt động</option><option value="suspended">Tạm khóa</option></select></td></tr>)}</tbody></table>{!primary?.length && <p className="manager-empty">Chưa có hồ sơ nhân sự.</p>}</div>
  </section>;

  if (active === 'finance') {
    const report = primary || { totals: {}, settlements: [] };
    return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Báo cáo tài chính" subtitle="Đối soát các khoản thanh toán chủ xe đã hoàn tất." /><DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="report-metrics"><ReportMetric label="Doanh thu thuê xe" value={report.totals.grossRentalRevenue} /><ReportMetric label="Phí nền tảng" value={report.totals.platformCommission} /><ReportMetric label="Đã trả chủ xe" value={report.totals.ownerPayout} /></div>
      <ReportRows rows={report.settlements || []} labels={['date', 'grossRentalRevenue', 'platformCommission', 'ownerPayout']} />
    </section>;
  }

  if (active === 'inspections') return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Báo cáo kiểm định xe" subtitle="Lịch sử kiểm định và biên bản xe ghi nhận tại gara." count={primary?.length || 0} /><DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>THỜI GIAN</th><th>PHƯƠNG TIỆN</th><th>BIỂN SỐ</th><th>KẾT QUẢ</th><th>GHI CHÚ</th></tr></thead><tbody>{(primary || []).map((item) => <tr key={item.id}><td>{item.inspectedAt ? new Date(item.inspectedAt).toLocaleString('vi-VN') : '—'}</td><td>{item.vehicle ? `${item.vehicle.brand} ${item.vehicle.model}` : '—'}</td><td>{item.vehicle?.license_plate || '—'}</td><td>{item.result}</td><td>{item.notes || '—'}</td></tr>)}</tbody></table>{!primary?.length && <p className="manager-empty">Chưa có báo cáo kiểm định.</p>}</div>
  </section>;

  return null;
}

function WorkspaceHeader({ title, subtitle, count }) {
  return <div className="workspace-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{count !== undefined && <span className="workspace-count">{count} hồ sơ</span>}</div>;
}

function DateFilter({ from, to, setFrom, setTo }) {
  return <div className="report-filters"><label>Từ ngày<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label>Đến ngày<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label><button onClick={() => { setFrom(''); setTo(''); }}>Xóa lọc</button></div>;
}

function ReportMetric({ label, value = 0 }) {
  return <div className="report-metric"><span>{label}</span><strong>{formatMoney(value)} ₫</strong></div>;
}

function ReportRows({ rows, labels }) {
  return <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>NGÀY ĐỐI SOÁT</th><th>DOANH THU THUÊ</th><th>PHÍ NỀN TẢNG</th><th>THANH TOÁN CHỦ XE</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.date}-${index}`}>{labels.map((label) => <td key={label}>{label === 'date' ? formatDate(row[label]) : `${formatMoney(row[label])} ₫`}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="manager-empty">Chưa có dữ liệu đối soát trong kỳ.</p>}</div>;
}

export default function ManagerPage() {
  const [active, setActive] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [period, setPeriod] = useState('7 ngày qua');
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('xedi_user') || sessionStorage.getItem('xedi_user') || '{}'); }
    catch { return {}; }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const periodCode = period === '30 ngày qua' ? '30d' : period === 'Tháng này' ? 'month' : '7d';
    getApi(`/manager/dashboard?period=${periodCode}`, { signal: controller.signal })
      .then((result) => { setDashboard(result.data); setDashboardError(''); })
      .catch((error) => { if (error.name !== 'AbortError') setDashboardError(error.status === 401 ? 'Vui lòng đăng nhập bằng tài khoản Quản lý để xem dashboard.' : error.status === 403 ? 'Tài khoản hiện tại chưa có quyền Quản lý.' : error.message); });
    return () => controller.abort();
  }, [period]);

  const selectSection = (id) => {
    setActive(id);
    setMenuOpen(false);
    if (id !== 'overview') setNotice(`Đang xem mục ${sections.find((item) => item.id === id)?.label}.`);
    else setNotice('');
  };

  return <div className="manager-app">
    <aside className={`manager-sidebar ${menuOpen ? 'is-open' : ''}`}>
      <div className="manager-brand"><Brand /><span className="manager-brand-tag">VẬN HÀNH</span></div>
      <div className="manager-workspace"><span className="workspace-mark">X</span><span><strong>XeDi Việt Nam</strong><small>Trung tâm vận hành</small></span><Icon name="down" size={15} /></div>
      <span className="manager-nav-label">KHÔNG GIAN QUẢN LÝ</span>
      <nav className="manager-nav" aria-label="Quản lý">
        {sections.map((item) => <button key={item.id} className={active === item.id ? 'selected' : ''} onClick={() => selectSection(item.id)}><Icon name={item.icon} size={18} />{item.label}{item.id === 'vehicles' && dashboard?.metrics.pendingVehicles > 0 && <span className="nav-count">{dashboard.metrics.pendingVehicles}</span>}</button>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="manager-help"><span className="help-mark">?</span><strong>Cần hỗ trợ?</strong><p>Liên hệ đội ngũ kỹ thuật nếu bạn gặp sự cố.</p><button onClick={() => setNotice('Đội ngũ hỗ trợ sẽ liên hệ với bạn trong giờ làm việc.')}>Liên hệ hỗ trợ <span>→</span></button></div>
      <div className="manager-sidebar-user"><span className="user-avatar">{(user.full_name || 'QL').slice(0, 1).toUpperCase()}</span><span><strong>{user.full_name || 'Quản lý XeDi'}</strong><small>Quản lý vận hành</small></span><button aria-label="Tùy chọn tài khoản" onClick={() => setNotice('Tài khoản quản lý đang hoạt động.')}>···</button></div>
    </aside>
    {menuOpen && <button className="manager-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
    <div className="manager-main">
      <header className="manager-topbar"><button className="manager-menu-toggle" aria-label="Mở menu" onClick={() => setMenuOpen(true)}><Icon name="menu" /></button><div className="manager-breadcrumb">Không gian quản lý <span>/</span> <strong>{sections.find((item) => item.id === active)?.label}</strong></div><div className="manager-top-actions"><span className="manager-live"><i /> Hệ thống hoạt động</span><button className="manager-icon-button" aria-label="Thông báo" onClick={() => setNotice('Bạn đã đọc các thông báo mới nhất.')}><span className="notification-dot" />♧</button><button className="manager-top-user" title={user.full_name || 'Quản lý'}>{(user.full_name || 'QL').slice(0, 1).toUpperCase()}</button></div></header>
      <main className="manager-content">
        <section className="manager-page-heading"><div><span className="manager-eyebrow"><span /> {new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toLocaleUpperCase('vi-VN')}</span><h1>{active === 'overview' ? 'Tổng quan vận hành' : sections.find((item) => item.id === active)?.label}</h1><p>Theo dõi hoạt động và xử lý công việc trên toàn hệ thống XeDi.</p></div><div className="manager-heading-actions"><button className="manager-export" onClick={() => { const rows = [['Chi so', 'Gia tri'], ['Xe dang hoat dong', dashboard?.metrics.activeVehicles ?? 0], ['Ho so cho duyet', dashboard?.metrics.pendingVehicles ?? 0], ['Su co dang mo', dashboard?.metrics.openIncidents ?? 0], ['Phi nen tang thang (VND)', dashboard?.metrics.monthlyPlatformRevenue ?? 0], ...((dashboard?.revenue.series || []).map((item) => [item.date, item.amount]))]; const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'xedi-manager-report.csv'; link.click(); URL.revokeObjectURL(url); setNotice('Đã xuất báo cáo CSV.'); }}>↓ <span>Xuất báo cáo</span></button><button className="manager-primary" onClick={() => window.location.reload()}>↻ <span>Làm mới</span></button></div></section>
        {notice && <div className="manager-notice" role="status"><Icon name="info" size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}
        {dashboardError && <div className="manager-notice manager-error" role="alert"><Icon name="info" size={17} />{dashboardError}<a href="#/login">Đăng nhập</a></div>}
        {active === 'overview' ? <>
        <section className="manager-metrics" aria-label="Chỉ số vận hành">
          <Metric icon="car" tone="blue" label="Xe đang hoạt động" value={dashboard ? String(dashboard.metrics.activeVehicles).padStart(2, '0') : '—'} detail="Xe đã duyệt & niêm yết" trend={`${dashboard?.metrics.staffCount ?? '—'} nhân sự`} />
          <Metric icon="document" tone="amber" label="Chờ kiểm duyệt" value={dashboard ? String(dashboard.metrics.pendingVehicles).padStart(2, '0') : '—'} detail="Hồ sơ xe cần xem xét" trend="Chờ xử lý" />
          <Metric icon="info" tone="rose" label="Khiếu nại đang mở" value={dashboard ? String(dashboard.metrics.openIncidents).padStart(2, '0') : '—'} detail="Sự cố chưa được giải quyết" trend="Cần theo dõi" />
          <Metric icon="wallet" tone="green" label="Phí nền tảng tháng" value={dashboard ? `${(dashboard.metrics.monthlyPlatformRevenue / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr` : '—'} detail="Từ đối soát đã thanh toán" trend={dashboard?.metrics.revenueChangePercent === null ? 'Chưa có kỳ trước' : `${dashboard?.metrics.revenueChangePercent ?? '—'}%`} />
        </section>
        {dashboardError && <p className="manager-data-note">Dữ liệu dashboard chỉ hiển thị sau khi API xác thực quyền Quản lý thành công.</p>}
        <div className="manager-dashboard-grid">
          <section className="manager-panel revenue-panel"><div className="manager-panel-heading"><div><h2>Doanh thu nền tảng</h2><p>Phí nền tảng ghi nhận theo thời gian</p></div><label className="manager-period"><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Khoảng thời gian"><option>7 ngày qua</option><option>30 ngày qua</option><option>Tháng này</option></select><Icon name="down" size={14} /></label></div>
            <div className="revenue-summary"><strong>{formatMoney(dashboard?.revenue.total || 0)} <small>₫</small></strong><span>{dashboard?.revenue.series.length ? `${dashboard.revenue.series.length} ngày gần nhất` : 'Chưa có dữ liệu đối soát'}</span></div>
            <div className="chart-legend"><span><i /> Phí nền tảng đã đối soát</span></div>
            <div className="revenue-chart" role="img" aria-label={`Biểu đồ doanh thu ${period}`}><div className="chart-y-labels"><span>40tr</span><span>30tr</span><span>20tr</span><span>10tr</span><span>0</span></div><div className="chart-plot"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 700 205" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#155eef" stopOpacity=".17"/><stop offset="100%" stopColor="#155eef" stopOpacity="0"/></linearGradient></defs><path d={`${revenuePath(dashboard?.revenue.series)} L700,205 L0,205 Z`} fill="url(#revenueFill)"/><path d={revenuePath(dashboard?.revenue.series)} fill="none" stroke="#155eef" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg><div className="chart-x-labels">{(dashboard?.revenue.series || []).filter((_, index, all) => index === 0 || index === all.length - 1 || index === Math.floor(all.length / 2)).map((item) => <span key={item.date}>{formatDate(item.date)}</span>)}</div></div></div>
          </section>
          <section className="manager-panel activity-panel"><div className="manager-panel-heading"><div><h2>Hoạt động gần đây</h2><p>Cập nhật mới nhất từ các bộ phận</p></div><button className="panel-more" aria-label="Xem thêm hoạt động" onClick={() => setNotice('Đang hiển thị những hoạt động mới nhất.')}>···</button></div><div className="activity-list">{(dashboard?.activities || []).map((item) => <article className="activity-item" key={item.id}><span className="activity-icon blue"><Icon name="info" size={15} /></span><div><p>{item.actor} {actionText(item.action, item.entityType)}</p><span>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : 'Vừa cập nhật'}</span></div></article>)}{dashboard && !dashboard.activities.length && <p className="manager-empty">Chưa có hoạt động được ghi nhận.</p>}</div><button className="activity-link" onClick={() => setNotice('Đang hiển thị các bản ghi audit mới nhất.')}>Xem tất cả hoạt động <span>→</span></button></section>
        </div>
        <section className="manager-panel requests-panel"><div className="manager-panel-heading"><div><h2>Yêu cầu cần xử lý</h2><p>Các công việc đang chờ đội ngũ quản lý xem xét</p></div><button className="all-requests" onClick={() => selectSection('vehicles')}>Xem tất cả <span>→</span></button></div><div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>YÊU CẦU</th><th>LOẠI</th><th>NGƯỜI GỬI</th><th>THỜI GIAN</th><th>TRẠNG THÁI</th><th /></tr></thead><tbody>{(dashboard?.requests || []).map((request) => <tr key={request.id}><td><strong>{request.title}</strong><span>{request.code}</span></td><td>{request.type}</td><td>{request.owner}</td><td>{formatDate(request.createdAt)}</td><td><span className={`request-status ${request.type.includes('sự cố') ? 'rose' : 'amber'}`}><i />{requestStatus(request.status)}</span></td><td><button className="row-action" aria-label={`Mở ${request.code}`} onClick={() => setNotice(`Mã yêu cầu ${request.code}. API xử lý chi tiết sẽ được bổ sung theo luồng nghiệp vụ.`)}>→</button></td></tr>)}</tbody></table>{dashboard && !dashboard.requests.length && <p className="manager-empty">Không có yêu cầu đang chờ xử lý.</p>}</div></section>
        </> : <ManagementWorkspace active={active} onNotice={setNotice} />}
        <footer className="manager-footer"><span>© 2026 XeDi · Trung tâm vận hành</span><span><i /> Cập nhật lần cuối: vừa xong</span></footer>
      </main>
    </div>
  </div>;
}
