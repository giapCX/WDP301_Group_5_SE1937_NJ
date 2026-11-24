import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import Icon from '../../home/components/HomeIcon.js';
import { hotline } from '../../home/homeContent.js';
import useHomeResource from '../../home/hooks/useHomeResource.js';
import { loadRenterDashboard } from '../api/renterDashboardApi.js';
import RenterLayout from '../components/RenterLayout.jsx';

const date = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
});
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const statusLabels = new Map([
  ['confirmed', 'Đã xác nhận'], ['in_progress', 'Đang thực hiện'], ['completed', 'Hoàn thành'],
  ['cancelled', 'Đã hủy'], ['rejected', 'Đã từ chối'],
]);
const metrics = [
  ['total', 'Tổng chuyến đã đặt', 'receipt_long', 'blue'],
  ['completed', 'Chuyến đã hoàn thành', 'verified', 'teal'],
  ['upcoming', 'Chuyến đi sắp tới', 'calendar_month', 'indigo'],
  ['offers', 'Ưu đãi đang có', 'redeem', 'orange'],
];
const shortcuts = [
  ['flight_land', 'Đưa đón sân bay', 'Chọn điểm đón và giờ hẹn.', '/renter/bookings/new?service=roundtrip'],
  ['route', 'Thuê xe theo tour', 'Lên lịch qua nhiều điểm dừng.', '/renter/bookings/new?service=tour'],
  ['airport_shuttle', 'Limousine và xe đoàn', 'Đặt xe từ 7 chỗ trở lên.', '/renter/bookings/new?minSeats=7'],
  ['edit_road', 'Lộ trình tự thiết kế', 'Chọn điểm đến cho chuyến đi riêng.', '/renter/bookings/new?service=tour'],
];

function formatDate(value) {
  const timestamp = new Date(value);
  return value && Number.isFinite(+timestamp) ? date.format(timestamp) : 'Chưa xác định';
}

function StatusBadge({ status }) {
  return <span className="vt-r-badge" data-status={status}>{statusLabels.get(status) || 'Đang cập nhật'}</span>;
}

function TripDetails({ trip }) {
  const [failedPhoto, setFailedPhoto] = useState(false);
  const vehicle = [trip.vehicle?.brand, trip.vehicle?.model].filter(Boolean).join(' ');
  const photos = Array.isArray(trip.vehicle?.photos) ? trip.vehicle.photos : [];
  const photo = photos.find((url) => typeof url === 'string' && /^https?:\/\//i.test(url));
  const route = [trip.pickup_location, ...(trip.stops || []).map(({ location }) => location), trip.dropoff_location].filter(Boolean);

  return (
    <div className="vt-r-trip">
      <div>
        {photo && !failedPhoto
          ? <img src={photo} alt={vehicle || 'Xe đã đặt'} onError={() => setFailedPhoto(true)}/>
          : <div className="vt-r-trip-placeholder"><Icon name="airport_shuttle"/></div>}
        <strong>{vehicle || 'Chưa phân xe'}</strong>
        <small>Đơn #{trip.booking_id}</small>
      </div>
      <div>
        <StatusBadge status={trip.booking_status}/>
        <h3>{trip.pickup_location} → {trip.dropoff_location}</h3>
        <p className="vt-r-muted">{formatDate(trip.pickup_time)}</p>
        <details open>
          <summary>Chi tiết lộ trình</summary>
          <ol>{route.map((location, index) => <li key={index}>{location}</li>)}</ol>
        </details>
        {trip.update && (
          <p className="vt-r-muted">
            Cập nhật gần nhất · {statusLabels.get(trip.update.trip_status) || trip.update.trip_status}
            {' · '}{formatDate(trip.update.updated_at)}
          </p>
        )}
        <a href={hotline.href} className="vt-r-button">Liên hệ điều phối</a>
      </div>
    </div>
  );
}

function TripHistory({ history }) {
  return (
    <section id="lich-su" className="vt-r-panel">
      <h2>Lịch sử chuyến đi gần đây</h2>
      {history.length ? (
        <div className="vt-r-table-wrap" role="region" aria-label="Bảng lịch sử chuyến đi" tabIndex={0}>
          <table>
            <thead><tr>
              <th scope="col">Đơn đặt xe</th><th scope="col">Lộ trình</th><th scope="col">Giờ đón</th>
              <th scope="col">Trạng thái</th><th scope="col">Giá dự kiến</th>
            </tr></thead>
            <tbody>{history.map((trip) => (
              <tr key={trip.booking_id}>
                <th scope="row">#{trip.booking_id}</th>
                <td>{trip.pickup_location} → {trip.dropoff_location}</td>
                <td>{formatDate(trip.pickup_time)}</td>
                <td><StatusBadge status={trip.booking_status}/></td>
                <td>{Number.isFinite(trip.estimated_price) ? currency.format(trip.estimated_price) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="vt-r-empty">Bạn chưa có chuyến đi trong lịch sử.</p>}
    </section>
  );
}

function RenterContent({ data }) {
  const { currentTrip, history, offers, stats } = data;

  return (
    <>
      <section className="vt-r-grid" aria-label="Tổng quan chuyến đi">
        {metrics.map(([key, label, icon, tone]) => (
          <article key={key} className={`vt-r-panel vt-r-metric ${tone}`}>
            <div><span>{label}</span><Icon name={icon}/></div>
            <strong>{stats[key]}</strong>
          </article>
        ))}
      </section>
      <div className="vt-r-columns">
        <section id="chuyen-di" className="vt-r-panel">
          <h2>Chuyến đi hiện tại</h2>
          {currentTrip
            ? <TripDetails key={currentTrip.booking_id} trip={currentTrip}/>
            : <p className="vt-r-empty">Bạn chưa có chuyến đang diễn ra hoặc sắp khởi hành.</p>}
        </section>
        <section id="uu-dai" className="vt-r-panel">
          <h2>Ưu đãi đang có</h2>
          {offers.length ? (
            <ul className="vt-r-offers">
              {offers.map((offer) => (
                <li key={offer.promotion_id}>
                  <div><strong>{offer.code}</strong><span className="vt-r-badge vt-r-offer-discount">Giảm {offer.discount_percent}%</span></div>
                  <small>Hạn sử dụng · {formatDate(offer.valid_until)}</small>
                </li>
              ))}
            </ul>
          ) : <p className="vt-r-empty">Hiện chưa có ưu đãi.</p>}
        </section>
      </div>
      <TripHistory history={history}/>
      <section aria-labelledby="renter-shortcuts">
        <h2 id="renter-shortcuts">Đặt chuyến nhanh</h2>
        <div className="vt-r-grid">
          {shortcuts.map(([icon, label, description, to]) => (
            <Link className="vt-r-panel vt-r-shortcut" key={label} to={to}>
              <Icon name={icon}/><strong>{label}</strong><span>{description}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export default function RenterDashboardPage() {
  const user = useOutletContext();
  const { hash } = useLocation();
  const [revision, setRevision] = useState(0);
  const result = useHomeResource(loadRenterDashboard, revision);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, result.data]);

  if (result.error?.response?.status === 401) return <Navigate to="/login" replace/>;

  return (
    <RenterLayout user={user}>
      <section id="tong-quan" className="vt-r-panel vt-r-heading">
        <div><h1>Quản lý chuyến đi</h1><p>Xin chào, {user.full_name}.</p></div>
        <div className="vt-r-booking-actions">
          <Link to="/renter/bookings" className="vt-r-button">My Bookings</Link>
          <Link to="/renter/bookings/new" className="vt-r-button vt-r-primary"><Icon name="add_circle"/>Đặt chuyến đi mới</Link>
        </div>
      </section>
      {result.loading && <p role="status" className="vt-r-panel">Đang tải chuyến đi…</p>}
      {result.error && (
        <div role="alert" className="vt-r-panel vt-r-error">
          <span>Chưa thể tải dữ liệu chuyến đi.</span>
          <button type="button" className="vt-r-button" onClick={() => setRevision((value) => value + 1)}>Thử lại</button>
        </div>
      )}
      {result.data && <RenterContent data={result.data}/>}
    </RenterLayout>
  );
}
