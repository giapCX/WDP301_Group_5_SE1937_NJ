import Icon from '../../../components/ui/Icon';
import { clearSession } from '../../auth/session';
import { bangkokDate, garageSections, sectionKinds, isFinished } from '../data/garage';

export default function GarageLayout({
  user,
  section,
  onNavigate,
  tasks,
  onRefresh,
  permissions = [],
  children,
}) {
  const active = garageSections.find((item) => item.id === section);
  const name = user?.full_name || user?.email || 'Nhân viên gara';
  const initials = name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();
  const today = new Date(`${bangkokDate()}T12:00:00+07:00`).toLocaleDateString(
    'vi-VN',
    {
      timeZone: 'Asia/Bangkok',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  );
  return (
    <div className="garage-app">
      <aside className="gs-sidebar">
        <a className="gs-logo" href="/garage">
          <span>
            <Icon name="car" size={27} />
          </span>
          XeDi<span className="gs-logo-dot">.</span>
        </a>
        <div className="gs-workspace-label">KHÔNG GIAN LÀM VIỆC</div>
        <div className="gs-garage-selector">
          <span className="gs-garage-icon">
            <Icon name="garage" size={22} />
          </span>
          <div>
            <strong>Vận hành gara</strong>
            <small>Nhân viên gara</small>
          </div>
          <span className="gs-online-dot" />
        </div>
        <p className="gs-nav-label">VẬN HÀNH GARA</p>
        <nav aria-label="Garage Staff">
          {garageSections.filter((item) => {
            const required = { inspections: 'vehicle.inspect', intakes: 'vehicle.intake', handovers: 'handover.record', returns: 'handover.record', incidents: 'case.report' };
            return !required[item.id] || permissions.includes(required[item.id]);
          }).map((item) => {
            const count = tasks.filter(
              (task) =>
                task.kind === sectionKinds[item.id] &&
                !isFinished(task),
            ).length;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.id);
                }}
                className={section === item.id ? 'gs-nav-active' : ''}
                aria-current={section === item.id ? 'page' : undefined}
              >
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
                {count > 0 && <b>{count}</b>}
              </a>
            );
          })}
        </nav>
        <div className="gs-sidebar-bottom">
          <div className="gs-help-card">
            <Icon name="shield" size={22} />
            <strong>Ghi nhận đúng, an tâm mỗi chuyến</strong>
            <p>Kiểm tra đủ hạng mục trước khi xác nhận biên bản.</p>
          </div>
          <a href="/" className="gs-public-link">
            <Icon name="arrowLeft" size={16} />
            Về trang thuê xe
          </a>
          <button className="gs-reset" onClick={onRefresh}>
            <Icon name="history" size={15} />
            Tải lại danh sách
          </button>
          <div className="gs-profile">
            <span className="gs-avatar">{initials}</span>
            <div>
              <strong>{name}</strong>
              <small>Nhân viên gara</small>
            </div>
            <span className="gs-online-dot" />
          </div>
          <button className="gs-reset" onClick={clearSession}>Đăng xuất</button>
        </div>
      </aside>
      <div className="gs-main">
        <header className="gs-topbar">
          <div className="gs-breadcrumb">
            Không gian làm việc <span>/</span>
            <strong>{active.label}</strong>
          </div>
          <div className="gs-topbar-right">
            <span>
              <Icon name="calendar" size={15} />
              {today}
            </span>
            <span className="gs-shift">
              <i />
              Phiên làm việc
            </span>
            <span className="gs-avatar gs-avatar-small">{initials}</span>
          </div>
        </header>
        <div className="gs-preview-banner"><span>Danh sách chung theo quyền vận hành. Bản nháp chỉ người lập được sửa.</span><button className="gs-preview-reset" onClick={onRefresh}>Tải lại</button></div>
        <main className="gs-content">{children}</main>
        <footer className="gs-footer">
          <span>© 2026 XeDi · Không gian vận hành gara</span>
          <span>Kiểm tra kỹ lưỡng. Bàn giao an tâm.</span>
        </footer>
      </div>
    </div>
  );
}
