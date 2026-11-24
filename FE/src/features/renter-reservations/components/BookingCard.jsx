import { Link } from 'react-router-dom';
import { formatTime, money, services, vehicleName } from '../reservationFormat.js';

export const statuses = {
  pending: 'Chờ xử lý', quoted: 'Đã có báo giá', awaiting_payment: 'Chờ thanh toán', confirmed: 'Đã xác nhận',
  rejected: 'Bị từ chối', in_progress: 'Đang thực hiện', completed: 'Đã hoàn thành', cancelled: 'Đã hủy',
};

export default function BookingCard({ booking, selected, onSelect }) {
  const status = booking.booking_status;
  const service = services.find(({ value }) => value === booking.service_type);
  const vehicle = booking.vehicle;
  const photo = [vehicle?.photos, vehicle?.illustration_photos].flat()
    .find((value) => typeof value === 'string' && /^https?:\/\//i.test(value));

  return (
    <article className="rv-panel rv-booking" data-selected={selected}>
      <header><h2>Đơn #{booking.booking_id}</h2><span className="rv-status" data-status={status}>
        {status === 'pending' && booking.quote_requested_at ? 'Chờ xem xét' : statuses[status] || status}
      </span></header>
      <div className="rv-booking-trip">
        {photo && <img src={photo} alt={vehicleName(vehicle)} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }}/>}
        <div>
          <strong>{service?.label || (vehicle ? vehicleName(vehicle) : 'Chuyến đi VietTour')}</strong>
          {service && vehicle && <p>{vehicleName(vehicle)}</p>}
          {booking.requested_seats && <p>Yêu cầu xe từ {booking.requested_seats} chỗ</p>}
          <p>{booking.pickup_location} → {booking.dropoff_location}</p>
          <small>{formatTime(booking.pickup_time)}{booking.passenger_count ? ' · ' + booking.passenger_count + ' hành khách' : ''}</small>
        </div>
      </div>
      {status === 'rejected' && <p className="rv-error">{booking.rejection_reason || 'Yêu cầu đã bị từ chối.'} <Link to="/renter/bookings/new">Đặt chuyến khác</Link></p>}
      {status === 'pending' && <p className="rv-notice">{booking.quote_requested_at ? 'Operator đang xem xét lịch trình và chuẩn bị báo giá. Bạn chưa cần thanh toán.' : 'VietTour đang kiểm tra lịch trình và khả năng phục vụ.'}</p>}
      {status === 'awaiting_payment' && <p className="rv-notice">{booking.paymentDue?.purpose === 'deposit' ? 'Đã xác nhận báo giá. Vui lòng đặt cọc để giữ xe.' : 'Đơn đã được duyệt. Vui lòng thanh toán để xác nhận.'}</p>}
      {booking.deposit_paid_at && <p className="rv-notice">Đã đặt cọc {money(booking.deposit_due)}.</p>}
      <footer><strong>{status === 'pending' && booking.quote_requested_at ? 'Chưa có giá' : money(booking.pricing_breakdown?.total ?? booking.estimated_price)}</strong>
        {(status === 'quoted' || booking.paymentDue) && <button type="button" className="rv-button rv-primary" aria-pressed={selected}
          onClick={() => onSelect(booking.booking_id)}>{status === 'quoted' ? 'Xem báo giá' : 'Chọn thanh toán'}</button>}
      </footer>
    </article>
  );
}

