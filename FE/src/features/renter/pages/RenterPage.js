import RenterLayout from '../components/RenterLayout';
import RenterHome from './RenterHome';
import { useState, useEffect } from 'react';
import Profile from '../components/Profile';
import BookingWorkspace from '../components/BookingWorkspace';
import { vnd, dateTime, statusName } from '../api/renterApi';
import useRenterWorkspace from '../hooks/useRenterWorkspace';
import '../styles/renter.css';
import '../styles/renter-portal.css';
export default function RenterPage() {
  const [route, setRoute] = useState(window.location.hash),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const change = () => {
      if (/^#\/renter\/cars\/?$/.test(window.location.hash)) {
        window.location.replace('/#xe-noi-bat');
        return;
      }
      setRoute(window.location.hash);
      setPage(1);
    };
    window.addEventListener('hashchange', change);
    change();
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const tab = route.includes('/profile') ? 'profile' : route.includes('/incidents') ? 'incidents' : route.includes('/bookings') ? 'bookings' : 'home';
  const bookingId = route.match(/bookings\/([a-f0-9]{24})/i)?.[1];
  const { token, config, error, bookings, incidents, pagination, loading } = useRenterWorkspace({ page, filter, search, retry });
  const visible = bookings;
  return <RenterLayout tab={tab} token={token} connected={Boolean(config)} error={error}>
    {!token ? <section className="renter-card"><p>Đăng nhập để xem dữ liệu của bạn.</p><a href="#/login">Đăng nhập</a></section> : <>{config?.services.payment === 'demo' && <p className="renter-notice">Môi trường mô phỏng OTP và thanh toán.</p>}{error && <div role="alert" className="renter-error">{error} <button onClick={() => setRetry(retry + 1)}>Thử lại</button> <a href="#/login">Đăng nhập lại</a></div>}
      {tab === 'home' ? <RenterHome /> : tab === 'profile' ? <Profile /> : tab === 'incidents' ? <section className="renter-card"><h2>Sự cố đã báo cáo</h2><p>Báo cáo mới từ chi tiết chuyến đang thuê.</p>{loading ? <p role="status">Đang tải...</p> : incidents.length ? incidents.map(i => <article key={i._id}><h3>{i.case_number} · {statusName(i.status)}</h3><p>{dateTime(i.created_at)} · {i.description}</p>{i.resolution && <p>Kết quả xử lý: {i.resolution.note || i.resolution.outcome}</p>}</article>) : <p>Chưa có báo cáo sự cố.</p>}</section> : bookingId ? <BookingWorkspace key={bookingId} bookingId={bookingId} config={config} onChanged={() => setRetry(v => v + 1)} /> : <section className="renter-card"><h2>Lịch sử chuyến đi</h2><div className="renter-grid"><label className="renter-field">Trạng thái<select value={filter} onChange={e => {
                setFilter(e.target.value);
                setPage(1);
              }}>{[['all', 'Tất cả'], ['active', 'Đã xác nhận / Đang thuê'], ['awaiting_payment', 'Chờ thanh toán'], ['completed', 'Hoàn tất'], ['cancelled', 'Đã hủy'], ['expired', 'Hết hạn']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="renter-field">Mã chuyến / biển số<input maxLength={50} value={search} onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }} /></label></div><p className="renter-muted">{pagination.total || 0} chuyến phù hợp.</p>{loading ? <p role="status">Đang tải chuyến đi...</p> : visible.length ? <div className="renter-stack">{visible.map(b => <article className="renter-card" key={b._id}><div className="renter-row"><strong>{b.vehicle?.brand} {b.vehicle?.model} · {b.vehicle?.license_plate}</strong><span>{statusName(b.status)}</span></div><p>{b.booking_code}</p><p>{dateTime(b.start_at)} → {dateTime(b.end_at)}</p><p>Tiền thuê {vnd(b.rental_fee_amount)} · Cọc {vnd(b.deposit_amount_snapshot)}</p><a href={'#/renter/bookings/' + b._id}>Xem hợp đồng, thanh toán và chi tiết →</a></article>)}</div> : <p>Chưa có chuyến đi phù hợp.</p>}<div className="renter-row"><button disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}/{pagination.totalPages || 1}</span><button disabled={loading || page >= (pagination.totalPages || 1)} onClick={() => setPage(page + 1)}>Trang sau</button></div></section>}
    </>}
  </RenterLayout>;
}
