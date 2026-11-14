import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import { Brand } from '../../../components/SiteHeader';
import AccountsWorkspace from '../../manager/components/AccountsWorkspace';
import AdminToolsWorkspace from '../../manager/components/AdminToolsWorkspace';
import ReportsWorkspace from '../../manager/components/ReportsWorkspace';
import UserMenu from '../../manager/components/UserMenu';
import useManagerAdminOverview from '../../manager/hooks/useManagerAdminOverview';
import { ChangeSummary, humanizeField } from '../../manager/components/dataDisplay';
import '../../manager/pages/ManagerPage.css';
import './AdminPage.css';

const adminSections = [
  { id: 'overview', label: 'Tổng quan', icon: 'gear' },
  { id: 'accounts', label: 'Tài khoản', icon: 'people' },
  { id: 'roles', label: 'Vai trò & quyền', icon: 'gear' },
  { id: 'auditLogs', label: 'Nhật ký audit', icon: 'document' },
  { id: 'finance', label: 'Tài chính', icon: 'wallet' },
  { id: 'savedReports', label: 'Báo cáo đã lưu', icon: 'document' },
];

const actionLabels = {
  'account.create': 'Tạo tài khoản',
  'account.update': 'Cập nhật tài khoản',
  'role.create': 'Tạo vai trò',
  'role.update': 'Cập nhật vai trò',
  'report.generated': 'Tạo báo cáo',
  'auth.login': 'Đăng nhập',
  'auth.login.failed': 'Đăng nhập thất bại',
};

function AdminOverview({ onSelect, snapshot, loading, error, refresh }) {

  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải tổng quan quản trị…</p></section>;
  if (error) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{error}<button onClick={refresh}>Thử lại</button></div></section>;

  return <>
    <section className="admin-overview-metrics">
      <article className="manager-metric"><span className="manager-metric-label">Tài khoản hệ thống</span><strong>{snapshot.accountCount}</strong><span className="manager-metric-detail">Tổng tài khoản trên toàn hệ thống</span></article>
      <article className="manager-metric"><span className="manager-metric-label">Vai trò chính</span><strong>{snapshot.roleCount}</strong><span className="manager-metric-detail">Không tính Admin và profile phụ</span></article>
      <article className="manager-metric"><span className="manager-metric-label">Tài khoản hoạt động</span><strong>{snapshot.activeAccountCount}</strong><span className="manager-metric-detail">Có thể đăng nhập</span></article>
      <article className="manager-metric"><span className="manager-metric-label">Hoạt động gần đây</span><strong>{snapshot.recentLogs.length}</strong><span className="manager-metric-detail">5 bản ghi gần nhất</span></article>
    </section>
    <section className="manager-panel admin-recent-panel"><div className="manager-panel-heading"><div><h2>Hoạt động quản trị gần đây</h2><p>Các thay đổi tài khoản, vai trò và báo cáo mới nhất.</p></div><button className="all-requests" onClick={() => onSelect('auditLogs')}>Mở nhật ký <span>→</span></button></div>
      <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>THỜI GIAN</th><th>NGƯỜI THỰC HIỆN</th><th>THAO TÁC</th><th>THAY ĐỔI</th></tr></thead><tbody>{snapshot.recentLogs.map((item) => <tr key={item.id}><td>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</td><td>{item.actor}<span>{item.actorEmail || ''}</span></td><td><span className="audit-action-pill">{actionLabels[item.action] || humanizeField(item.action)}</span></td><td><ChangeSummary changes={item.changes} /></td></tr>)}</tbody></table>{!snapshot.recentLogs.length && <p className="manager-empty">Chưa có hoạt động quản trị.</p>}</div>
    </section>
  </>;
}

export default function AdminPage() {
  const { snapshot, loading, error, refresh } = useManagerAdminOverview();
  const [active, setActive] = useState('overview');
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('xedi_user') || sessionStorage.getItem('xedi_user') || '{}'); }
    catch { return {}; }
  }, []);
  const canAdminister = user.roles?.includes('ADMIN') || user.role?.code === 'ADMIN';
  const canManage = user.roles?.includes('MANAGER') || user.role?.code === 'MANAGER';

  useEffect(() => {
    if (canAdminister) return;
    window.location.hash = canManage ? '#/manager' : '#/login';
  }, [canAdminister, canManage]);

  const selectSection = (id) => {
    if (!adminSections.some((section) => section.id === id)) return;
    setActive(id);
    setMenuOpen(false);
    setNotice(id === 'overview' ? '' : `Đang xem mục ${adminSections.find((item) => item.id === id)?.label}.`);
  };

  const exportOverview = () => {
    if (!snapshot) return;
    const rows = [
      ['Chỉ số quản trị', 'Giá trị'],
      ['Tổng tài khoản', snapshot.accountCount],
      ['Vai trò chính', snapshot.roleCount],
      ['Tài khoản hoạt động', snapshot.activeAccountCount],
      ['Nhật ký gần đây', snapshot.recentLogs.length],
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'xedi-admin-report.csv';
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Đã xuất báo cáo quản trị.');
  };

  if (!canAdminister) return <div className="manager-app"><main className="manager-content"><section className="manager-panel"><p className="manager-empty">Đang chuyển đến khu vực phù hợp với tài khoản…</p></section></main></div>;

  return <div className="manager-app admin-app">
    <aside className={`manager-sidebar ${menuOpen ? 'is-open' : ''}`}>
      <div className="manager-brand"><Brand /><span className="manager-brand-tag">QUẢN TRỊ HỆ THỐNG</span></div>
      <div className="manager-workspace"><span className="workspace-mark">X</span><span><strong>XeDi Việt Nam</strong><small>Trung tâm quản trị</small></span><Icon name="down" size={15} /></div>
      <span className="manager-nav-label">KHÔNG GIAN QUẢN TRỊ</span>
      <nav className="manager-nav" aria-label="Quản trị hệ thống">{adminSections.map((item) => <button key={item.id} className={active === item.id ? 'selected' : ''} onClick={() => selectSection(item.id)}><Icon name={item.icon} size={18} />{item.label}</button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="manager-help"><span className="help-mark">?</span><strong>Cần hỗ trợ?</strong><p>Liên hệ đội ngũ kỹ thuật nếu bạn gặp sự cố.</p><button onClick={() => setNotice('Đội ngũ hỗ trợ sẽ liên hệ với bạn trong giờ làm việc.')}>Liên hệ hỗ trợ <span>→</span></button></div>
      <div className="manager-sidebar-user"><span className="user-avatar">{(user.full_name || 'AD').slice(0, 1).toUpperCase()}</span><span><strong>{user.full_name || 'Quản trị viên'}</strong><small>Quản trị viên hệ thống</small></span><button aria-label="Tùy chọn tài khoản" onClick={() => setNotice('Tài khoản đang hoạt động.')}>···</button></div>
    </aside>
    {menuOpen && <button className="manager-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
    <div className="manager-main">
      <header className="manager-topbar"><button className="manager-menu-toggle" aria-label="Mở menu" onClick={() => setMenuOpen(true)}><Icon name="menu" /></button><div className="manager-breadcrumb">Quản trị hệ thống <span>/</span> <strong>{adminSections.find((item) => item.id === active)?.label}</strong></div><div className="manager-top-actions"><span className="manager-live"><i /> Hệ thống hoạt động</span><UserMenu user={user} roleLabel="Quản trị viên hệ thống" /></div></header>
      <main className="manager-content">
        <section className="manager-page-heading"><div><span className="manager-eyebrow"><span /> {new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toLocaleUpperCase('vi-VN')}</span><h1>{active === 'overview' ? 'Tổng quan quản trị' : adminSections.find((item) => item.id === active)?.label}</h1><p>Quản lý tài khoản, vai trò và hoạt động hệ thống XeDi.</p></div><div className="manager-heading-actions">{active === 'overview' && <button className="manager-export" disabled={!snapshot || loading || Boolean(error)} onClick={exportOverview}>↓ <span>Xuất báo cáo</span></button>}<button className="manager-primary" onClick={() => window.location.reload()}>↻ <span>Làm mới</span></button></div></section>
        {notice && <div className="manager-notice" role="status"><Icon name="info" size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}
        {active === 'overview' ? <AdminOverview onSelect={selectSection} snapshot={snapshot} loading={loading} error={error} refresh={refresh} />
          : active === 'accounts' ? <AccountsWorkspace onNotice={setNotice} />
            : active === 'roles' || active === 'auditLogs' ? <AdminToolsWorkspace key={active} active={active} onNotice={setNotice} />
              : <ReportsWorkspace key={active} active={active} onNotice={setNotice} />}
        <footer className="manager-footer"><span>© 2026 XeDi · Trung tâm quản trị</span><span><i /> Hệ thống hoạt động</span></footer>
      </main>
    </div>
  </div>;
}
