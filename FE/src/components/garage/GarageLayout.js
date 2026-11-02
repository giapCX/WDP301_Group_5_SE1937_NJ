import Icon from '../ui/Icon';
import { bangkokDate, garageSections, sectionKinds } from '../../data/garage';

export default function GarageLayout({
  section,
  onNavigate,
  tasks,
  onReset,
  children,
}) {
  const active = garageSections.find((item) => item.id === section);
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
            <strong>Gara Tân Bình</strong>
            <small>Nhân viên gara · GS-010</small>
          </div>
          <span className="gs-online-dot" />
        </div>
        <p className="gs-nav-label">VẬN HÀNH GARA</p>
        <nav aria-label="Garage Staff">
          {garageSections.map((item) => {
            const count = tasks.filter(
              (task) =>
                task.kind === sectionKinds[item.id] &&
                !['completed', 'submitted'].includes(task.status),
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
          <button className="gs-reset" onClick={onReset}>
            <Icon name="history" size={15} />
            Khôi phục dữ liệu mẫu
          </button>
          <div className="gs-profile">
            <span className="gs-avatar">MA</span>
            <div>
              <strong>Minh Anh</strong>
              <small>Nhân viên gara</small>
            </div>
            <span className="gs-online-dot" />
          </div>
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
              Ca làm · 08:00 – 17:00
            </span>
            <span className="gs-avatar gs-avatar-small">MA</span>
          </div>
        </header>
        <div className="gs-preview-banner">
          <span className="gs-preview-tag">BẢN THỬ NGHIỆM</span>
          <span>
            Dữ liệu mẫu · Các thao tác được lưu trên trình duyệt để bạn trải
            nghiệm.
          </span>
          <button className="gs-preview-reset" onClick={onReset}>
            Đặt lại mẫu
          </button>
        </div>
        <main className="gs-content">{children}</main>
        <footer className="gs-footer">
          <span>© 2026 XeDi · Không gian vận hành gara</span>
          <span>Kiểm tra kỹ lưỡng. Bàn giao an tâm.</span>
        </footer>
      </div>
    </div>
  );
}
