import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadBookings, startCheckout } from '../api/reservationsApi.js';
import PriceSummary from '../components/PriceSummary.jsx';
import QuoteAcceptance from '../components/QuoteAcceptance.jsx';
import ReservationLayout from '../components/ReservationLayout.jsx';
import { errorMessage, formatTime, money, services, vehicleName } from '../reservationFormat.js';

const statuses = {
  pending: 'Chờ xử lý', quoted: 'Đã có báo giá', awaiting_payment: 'Chờ thanh toán', confirmed: 'Đã xác nhận',
  rejected: 'Bị từ chối', in_progress: 'Đang thực hiện', completed: 'Đã hoàn thành', cancelled: 'Đã hủy',
};

function BookingCard({ booking, selected, onSelect }) {
  const status = booking.booking_status;
  const service = services.find(({ value }) => value === booking.service_type);
  const vehicle = booking.vehicle;
  const photo = [vehicle?.photos, vehicle?.illustration_photos].flat()
    .find((value) => typeof value === 'string' && /^https?:\/\//i.test(value));

  return (
    <article className="rv-panel rv-booking" data-selected={selected}>
      <header><h2>Đơn #{booking.booking_id}</h2><span className="rv-status" data-status={status}>
        {status === 'pending' && booking.quote_requested_at ? 'Chờ báo giá' : statuses[status] || status}
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
      {status === 'pending' && <p className="rv-notice">{booking.quote_requested_at ? 'Đang đợi VietTour gửi báo giá.' : 'VietTour đang kiểm tra lịch trình và khả năng phục vụ.'}</p>}
      {status === 'awaiting_payment' && <p className="rv-notice">{booking.paymentDue?.purpose === 'deposit' ? 'Đã xác nhận báo giá. Vui lòng đặt cọc để giữ xe.' : 'Đơn đã được duyệt. Vui lòng thanh toán để xác nhận.'}</p>}
      {booking.deposit_paid_at && <p className="rv-notice">Đã đặt cọc {money(booking.deposit_due)}.</p>}
      <footer><strong>{status === 'pending' && booking.quote_requested_at ? 'Chưa có giá' : money(booking.pricing_breakdown?.total ?? booking.estimated_price)}</strong>
        {(status === 'quoted' || booking.paymentDue) && <button type="button" className="rv-button rv-primary" aria-pressed={selected}
          onClick={() => onSelect(booking.booking_id)}>{status === 'quoted' ? 'Xem báo giá' : 'Chọn thanh toán'}</button>}
      </footer>
    </article>
  );
}

export default function MyBookingsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const selectedId = Number(params.get('booking'));
  const checkoutResult = params.get('checkout');
  const [list, setList] = useState({ items: [], nextBefore: null });
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    loadBookings(null, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setList(data); })
      .catch((failure) => { if (!controller.signal.aborted) setError(errorMessage(failure, 'Chưa thể tải danh sách đơn.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const visible = list.items.filter((item) => !status || item.booking_status === status);
  const selected = list.items.find((item) => item.booking_id === selectedId);
  const payable = selected?.paymentDue ? selected : null;
  const amount = payable?.paymentDue.amount;
  const paymentLabel = payable?.paymentDue.purpose === 'deposit' ? 'Đặt cọc' : payable?.paymentDue.purpose === 'balance' ? 'Thanh toán phần còn lại' : 'Thanh toán';

  function changeParam(name, value) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('checkout');
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    });
  }

  async function loadMore() {
    setLoading(true);
    setError('');
    try {
      const data = await loadBookings(list.nextBefore);
      setList({ ...data, items: [...list.items, ...data.items] });
    } catch (failure) {
      setError(errorMessage(failure, 'Chưa thể tải thêm đơn.'));
    } finally {
      setLoading(false);
    }
  }

  async function pay() {
    setPaying(true);
    setError('');
    try {
      const result = await startCheckout(payable.booking_id);
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(errorMessage(failure, 'Chưa thể mở thanh toán. Vui lòng thử lại.'));
    } finally {
      setPaying(false);
    }
  }

  return (
    <ReservationLayout>
      <div className="rv-heading rv-heading-actions">
        <div><h1>Đơn đặt xe của tôi</h1><p>Theo dõi báo giá, đặt cọc và thanh toán chuyến đi.</p></div>
        <Link to="/renter/bookings/new" className="rv-button rv-primary">Đặt chuyến mới</Link>
      </div>
      {checkoutResult === 'cancelled' && <p className="rv-notice" role="status">Bạn đã rời trang thanh toán. Có thể chọn thanh toán lại.</p>}
      {selected?.booking_status === 'confirmed' && <p className="rv-success" role="status">Đơn #{selectedId} đã được xác nhận.</p>}
      {checkoutResult === 'complete' && selected?.paymentDue && <p className="rv-notice" role="status">Đang chờ xác minh giao dịch. Hãy cập nhật trạng thái sau ít phút.</p>}
      {checkoutResult === 'complete' && selected?.booking_status === 'completed' && !selected.paymentDue && <p className="rv-success" role="status">Đã thanh toán phần còn lại.</p>}
      {error && <p className="rv-error" role="alert">{error}</p>}
      <div className="rv-filters-bar">
        <div className="rv-tabs" aria-label="Lọc trạng thái" role="group">
          {[['', 'Tất cả'], ...Object.entries(statuses)].map(([key, label]) => (
            <button className="rv-button" key={label} type="button" aria-pressed={status === key}
              onClick={() => changeParam('status', key)}>{label}</button>
          ))}
        </div>
        <button className="rv-button" type="button" disabled={loading || paying} onClick={() => setRevision((value) => value + 1)}>Cập nhật</button>
      </div>
      <div className="rv-columns">
        <section className="rv-list" aria-label="Danh sách đơn đặt xe">
          {loading && <p role="status">Đang tải đơn đặt xe…</p>}
          {visible.map((booking) => <BookingCard key={booking.booking_id} booking={booking}
            selected={booking.booking_id === selectedId} onSelect={(id) => changeParam('booking', id)}/>)}
          {!loading && !visible.length && <p className="rv-panel">Chưa có đơn ở trạng thái này.</p>}
          {list.nextBefore && <button className="rv-button" type="button" disabled={loading} onClick={loadMore}>Tải thêm đơn</button>}
        </section>
        <aside className="rv-panel rv-summary" aria-label="Báo giá và thanh toán">
          {selected?.booking_status === 'quoted' ? <QuoteAcceptance key={selected.quote_offer.id + ':' + revision}
            booking={selected} onAccepted={() => { changeParam('status', ''); setRevision((value) => value + 1); }}/>
          : <h2>{payable ? paymentLabel + ' đơn #' + payable.booking_id : 'Báo giá và thanh toán'}</h2>}
          {payable ? <>
            {payable.pricing_breakdown && <PriceSummary price={payable.pricing_breakdown}/>}
            <p><strong>{paymentLabel} · {money(amount)}</strong></p>
            {payable.checkout_failed_at && <p className="rv-error" role="alert">Giao dịch trước không thành công. Bạn có thể thanh toán lại.</p>}
            {amount === 0
              ? <p>Ưu đãi đã chi trả toàn bộ đơn.</p>
              : <p>Chọn phương thức khả dụng trên trang thanh toán Stripe.</p>}
            {!list.checkoutAvailable && amount !== 0 && <p className="rv-notice">Thanh toán trực tuyến chưa được cấu hình.</p>}
            <button className="rv-button rv-primary" type="button" onClick={pay} disabled={paying || (!list.checkoutAvailable && amount !== 0)}>
              {paying ? 'Đang xử lý…' : amount === 0 ? 'Xác nhận đơn' : paymentLabel + ' qua Stripe'}
            </button>
          </> : !selected && <p>Chọn một đơn để xem báo giá hoặc thanh toán.</p>}
          {selected?.booking_status === 'pending' && selected.quote_requested_at && <p role="status">Đang đợi Operator gửi báo giá.</p>}
        </aside>
      </div>
    </ReservationLayout>
  );
}

