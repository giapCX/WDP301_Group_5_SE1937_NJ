import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import { Brand } from '../../../components/SiteHeader';
import ContractsWorkspace from '../components/ContractsWorkspace';
import BookingApprovalsWorkspace from '../components/BookingApprovalsWorkspace';
import ListingManagementWorkspace from '../components/ListingManagementWorkspace';
import OperationsWorkspace from '../components/OperationsWorkspace';
import ReportsWorkspace from '../components/ReportsWorkspace';
import UserMenu from '../components/UserMenu';
import VehicleApprovalsWorkspace from '../components/VehicleApprovalsWorkspace';
import IdentityVerificationWorkspace from '../components/IdentityVerificationWorkspace';
import useManagerDashboard from '../hooks/useManagerDashboard';
import './ManagerPage.css';

const sections = [
  { id: 'overview', label: 'Tổng quan', icon: 'gear' },
  { id: 'vehicles', label: 'Kiểm duyệt xe', icon: 'car' },
  { id: 'bookings', label: 'Duyệt yêu cầu thuê', icon: 'document' },
  { id: 'listings', label: 'Quản lý tin xe', icon: 'car' },
  { id: 'identityVerifications', label: 'Xét duyệt eKYC', icon: 'shield' },
  { id: 'incidents', label: 'Khiếu nại & sự cố', icon: 'info' },
  { id: 'policies', label: 'Chính sách nền tảng', icon: 'document' },
  { id: 'finance', label: 'Tài chính', icon: 'wallet' },
  { id: 'inspections', label: 'Báo cáo kiểm định', icon: 'check' },
  { id: 'staff', label: 'Nhân sự', icon: 'people' },
  { id: 'operations', label: 'Báo cáo hoạt động', icon: 'check' },
  { id: 'contracts', label: 'Quản lý hợp đồng', icon: 'document' },
  { id: 'savedReports', label: 'Báo cáo đã lưu', icon: 'document' },
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

export default function ManagerPage() {
  const [active, setActive] = useState('overview');
  const [period, setPeriod] = useState('7 ngày qua');
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('xedi_user') || sessionStorage.getItem('xedi_user') || '{}'); }
    catch { return {}; }
  }, []);
  const canManageOperations = user.roles?.includes('MANAGER') || user.role?.code === 'MANAGER';
  const visibleSections = sections;
  const hasRouteAccess = canManageOperations;
  const periodCode = period === '30 ngày qua' ? '30d' : period === 'Tháng này' ? 'month' : '7d';
  const { dashboard, error: dashboardError } = useManagerDashboard(periodCode);

  useEffect(() => {
    if (hasRouteAccess) return;
    window.location.hash = user.roles?.includes('ADMIN') || user.role?.code === 'ADMIN' ? '#/admin' : '#/login';
  }, [hasRouteAccess, user]);

  const selectSection = (id) => {
    if (!visibleSections.some((item) => item.id === id)) return;
    setActive(id);
    setMenuOpen(false);
    if (id !== 'overview') setNotice(`Đang xem mục ${visibleSections.find((item) => item.id === id)?.label}.`);
    else setNotice('');
  };

  if (!hasRouteAccess) return <div className="manager-app"><main className="manager-content"><section className="manager-panel"><p className="manager-empty">Đang chuyển đến khu vực phù hợp với tài khoản…</p></section></main></div>;

  return <div className="manager-app">
    <aside className={`manager-sidebar ${menuOpen ? 'is-open' : ''}`}>
      <div className="manager-brand"><Brand /><span className="manager-brand-tag">VẬN HÀNH</span></div>
      <div className="manager-workspace"><span className="workspace-mark">X</span><span><strong>XeDi Việt Nam</strong><small>Trung tâm vận hành</small></span><Icon name="down" size={15} /></div>
      <span className="manager-nav-label">KHÔNG GIAN QUẢN LÝ</span>
      <nav className="manager-nav" aria-label="Quản lý vận hành">
        {visibleSections.map((item) => <button key={item.id} className={active === item.id ? 'selected' : ''} onClick={() => selectSection(item.id)}><Icon name={item.icon} size={18} />{item.label}{item.id === 'vehicles' && dashboard?.metrics.pendingVehicles > 0 && <span className="nav-count">{dashboard.metrics.pendingVehicles}</span>}</button>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="manager-help"><span className="help-mark">?</span><strong>Cần hỗ trợ?</strong><p>Liên hệ đội ngũ kỹ thuật nếu bạn gặp sự cố.</p><button onClick={() => setNotice('Đội ngũ hỗ trợ sẽ liên hệ với bạn trong giờ làm việc.')}>Liên hệ hỗ trợ <span>→</span></button></div>
      <div className="manager-sidebar-user"><span className="user-avatar">{(user.full_name || 'QL').slice(0, 1).toUpperCase()}</span><span><strong>{user.full_name || 'Quản lý XeDi'}</strong><small>Quản lý vận hành</small></span><button aria-label="Tùy chọn tài khoản" onClick={() => setNotice('Tài khoản đang hoạt động.')}>···</button></div>
    </aside>
    {menuOpen && <button className="manager-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
    <div className="manager-main">
      <header className="manager-topbar"><button className="manager-menu-toggle" aria-label="Mở menu" onClick={() => setMenuOpen(true)}><Icon name="menu" /></button><div className="manager-breadcrumb">Quản lý vận hành <span>/</span> <strong>{sections.find((item) => item.id === active)?.label}</strong></div><div className="manager-top-actions"><span className="manager-live"><i /> Hệ thống hoạt động</span><button className="manager-icon-button" aria-label="Thông báo" onClick={() => setNotice('Bạn đã đọc các thông báo mới nhất.')}><span className="notification-dot" />♧</button><UserMenu user={user} roleLabel="Quản lý vận hành" /></div></header>
      <main className="manager-content">
        <section className="manager-page-heading"><div><span className="manager-eyebrow"><span /> {new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toLocaleUpperCase('vi-VN')}</span><h1>{active === 'overview' ? 'Tổng quan vận hành' : sections.find((item) => item.id === active)?.label}</h1><p>Theo dõi hoạt động và xử lý công việc trên toàn hệ thống XeDi.</p></div>{active === 'overview' && <div className="manager-heading-actions"><button className="manager-export" onClick={() => { const rows = [['Chi so', 'Gia tri'], ['Xe dang hoat dong', dashboard?.metrics.activeVehicles ?? 0], ['Ho so cho duyet', dashboard?.metrics.pendingVehicles ?? 0], ['Su co dang mo', dashboard?.metrics.openIncidents ?? 0], ['Phi nen tang thang (VND)', dashboard?.metrics.monthlyPlatformRevenue ?? 0], ...((dashboard?.revenue.series || []).map((item) => [item.date, item.amount]))]; const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'xedi-manager-report.csv'; link.click(); URL.revokeObjectURL(url); setNotice('Đã xuất báo cáo CSV.'); }}>↓ <span>Xuất báo cáo</span></button><button className="manager-primary" onClick={() => window.location.reload()}>↻ <span>Làm mới</span></button></div>}</section>
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
          <section className="manager-panel activity-panel"><div className="manager-panel-heading"><div><h2>Hoạt động gần đây</h2><p>Cập nhật mới nhất từ các bộ phận</p></div></div><div className="activity-list">{(dashboard?.activities || []).map((item) => <article className="activity-item" key={item.id}><span className="activity-icon blue"><Icon name="info" size={15} /></span><div><p>{item.actor} {actionText(item.action, item.entityType)}</p><span>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : 'Vừa cập nhật'}</span></div></article>)}{dashboard && !dashboard.activities.length && <p className="manager-empty">Chưa có hoạt động được ghi nhận.</p>}</div></section>
        </div>
        {canManageOperations && <section className="manager-panel requests-panel"><div className="manager-panel-heading"><div><h2>Yêu cầu cần xử lý</h2><p>Các công việc đang chờ đội ngũ quản lý xem xét</p></div></div><div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>YÊU CẦU</th><th>LOẠI</th><th>NGƯỜI GỬI</th><th>THỜI GIAN</th><th>TRẠNG THÁI</th></tr></thead><tbody>{(dashboard?.requests || []).map((request) => <tr key={request.id}><td><strong>{request.title}</strong><span>{request.code}</span></td><td>{request.type}</td><td>{request.owner}</td><td>{formatDate(request.createdAt)}</td><td><span className={`request-status ${request.type.includes('sự cố') ? 'rose' : 'amber'}`}><i />{requestStatus(request.status)}</span></td></tr>)}</tbody></table>{dashboard && !dashboard.requests.length && <p className="manager-empty">Không có yêu cầu đang chờ xử lý.</p>}</div></section>}
        </> : active === 'bookings'
            ? <BookingApprovalsWorkspace onNotice={setNotice} />
            : active === 'listings'
              ? <ListingManagementWorkspace onNotice={setNotice} />
            : active === 'vehicles'
            ? <VehicleApprovalsWorkspace onNotice={setNotice} />
            : active === 'identityVerifications'
              ? <IdentityVerificationWorkspace onNotice={setNotice} />
            : active === 'contracts'
              ? <ContractsWorkspace onNotice={setNotice} />
            : ['finance', 'inspections', 'operations', 'savedReports'].includes(active)
              ? <ReportsWorkspace key={active} active={active} onNotice={setNotice} />
              : <OperationsWorkspace key={active} active={active} onNotice={setNotice} />}
        <footer className="manager-footer"><span>© 2026 XeDi · Trung tâm vận hành</span><span><i /> Cập nhật lần cuối: vừa xong</span></footer>
      </main>
    </div>
  </div>;
}
