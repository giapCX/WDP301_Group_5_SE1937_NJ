import { useEffect, useState } from 'react';
import { getCurrentUser, clearSession } from '../../auth/session';
import Icon from '../../../components/Icon';
import '../../owner/pages/owner.css';

const items = [
  ['home', 'Trang chủ', 'calendar'],
  ['bookings', 'Chuyến đi & thanh toán', 'document'],
  ['profile', 'Hồ sơ cá nhân', 'people'],
  ['incidents', 'Sự cố đã báo cáo', 'shield'],
];
const titles = { home: 'Trang chủ khách thuê', profile: 'Hồ sơ cá nhân', bookings: 'Chuyến đi của bạn', incidents: 'Sự cố và hỗ trợ' };
const descriptions = {
  home: 'Tìm xe theo địa điểm và lịch thuê của bạn.',
  bookings: 'Quản lý lịch thuê, hợp đồng, thanh toán và yêu cầu hủy chuyến.',
  profile: 'Cập nhật thông tin cá nhân và địa chỉ liên hệ.',
  incidents: 'Theo dõi báo cáo và quá trình hỗ trợ trong chuyến thuê của bạn.',
};

export default function RenterLayout({ tab, token, connected, error, children }) {
  const [user, setUser] = useState(getCurrentUser);
  useEffect(() => {
    const update = () => setUser(getCurrentUser());
    window.addEventListener('xedi:session', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('xedi:session', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  const signOut = () => { clearSession(); window.location.hash = '#/login'; };
  const date = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

  return <div className="owner-app renter-portal">
    <aside className="owner-sidebar renter-sidebar">
      <a className="owner-brand" href="#/renter">XeDi<span>RENTER</span></a>
      <div className="owner-workspace"><span className="owner-avatar"><Icon name="car" size={20} /></span><span><strong>XeDi Renter Portal</strong><small>Không gian khách thuê</small></span></div>
      <small className="owner-nav-label">QUẢN LÝ CHUYẾN ĐI</small>
      <nav aria-label="Khách thuê">{items.map(([key, label, icon]) => <a key={key} className={`renter-sidebar-link ${tab === key ? 'selected' : ''}`} href={`#/renter/${key}`} aria-current={tab === key ? 'page' : undefined} title={label}><Icon name={icon} size={18} /><span>{label}</span></a>)}</nav>
      <div className="owner-sidebar-bottom">
        <div className="owner-help"><strong>Cần hỗ trợ chuyến đi?</strong><p>Theo dõi sự cố và cập nhật xử lý từ đội ngũ hỗ trợ XeDi.</p><a href="#/renter/incidents">Xem báo cáo sự cố <span>→</span></a></div>
        <div className="owner-account"><span className="owner-user-avatar">{(user?.full_name || 'K').slice(0, 1).toUpperCase()}</span><span><strong>{user?.full_name || 'Khách thuê'}</strong><small>Tài khoản khách thuê</small></span>{token && <button onClick={signOut} aria-label="Đăng xuất tài khoản" title="Đăng xuất">↗</button>}</div>
      </div>
    </aside>
    <div className="owner-main">
      <header className="owner-topbar"><div className="owner-breadcrumb">Cổng khách thuê <span>/</span><strong>{items.find(([key]) => key === tab)?.[1]}</strong></div><div className="owner-top-actions"><span className={`owner-live ${error ? 'renter-offline' : ''}`}><i />{error ? 'Chưa kết nối dữ liệu' : connected ? 'Đã kết nối dữ liệu' : 'Đang kết nối'}</span>{token && <button onClick={signOut}>Đăng xuất</button>}</div></header>
      <main className="owner-content renter-content">
        <div className="owner-heading"><div><span className="owner-eyebrow">{date.toLocaleUpperCase('vi-VN')}</span><h1>{titles[tab]}</h1><p>{descriptions[tab]}</p></div>{token && tab !== 'home' && <a className="owner-primary renter-heading-action" href="#/renter"><Icon name="search" size={15} /><span>Tìm xe thuê</span></a>}</div>
        {children}
        <footer className="owner-footer">© {new Date().getFullYear()} XeDi · Cổng thông tin dành cho khách thuê<span><i />Dữ liệu tài khoản được bảo vệ</span></footer>
      </main>
    </div>
  </div>;
}
