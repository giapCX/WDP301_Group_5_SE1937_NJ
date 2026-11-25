import { useState } from 'react';
import useHomeResource from '../../home/hooks/useHomeResource.js';
import { acceptReservationQuote, loadQuoteReview } from '../api/reservationsApi.js';
import { errorMessage, formatTime, money } from '../reservationFormat.js';
import PriceSummary from './PriceSummary.jsx';

export default function QuoteAcceptance({ booking, onAccepted }) {
  const review = useHomeResource(loadQuoteReview, booking.booking_id);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const price = booking.pricing_breakdown;

  async function confirm(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await acceptReservationQuote(booking.booking_id, booking.quote_offer.id);
      onAccepted();
    } catch (failure) {
      setError(errorMessage(failure, 'Chưa thể xác nhận báo giá.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="rv-quote-acceptance" onSubmit={confirm}>
      <h2>Báo giá đơn #{booking.booking_id}</h2>
      <PriceSummary price={price}/>
      {booking.requested_promotion_code && !booking.quote_offer.promotion_code && <p>Mã ưu đãi đã yêu cầu không áp dụng được.</p>}
      <p><strong>Đặt cọc {money(booking.deposit_due)}</strong> · Còn lại dự kiến {money(price.total - booking.deposit_due)}</p>
      <p>Đón tại {booking.pickup_location} · {formatTime(booking.pickup_time)}</p>
      {booking.return_pickup_time && <p>Đón về tại {booking.return_pickup_location} · {formatTime(booking.return_pickup_time)}</p>}
      <p>Trả tại {booking.dropoff_location} · {formatTime(booking.estimated_end_time)}</p>
      {review.loading && <p role="status">Đang tải chi tiết lịch trình…</p>}
      {review.error && <p role="alert" className="rv-error">Chưa tải được chi tiết. Hãy bấm Cập nhật.</p>}
      {review.data && <>
        {review.data.contact && <p>{[review.data.contact.full_name, review.data.contact.email, review.data.contact.phone].filter(Boolean).join(' · ')}</p>}
        {booking.service_type === 'tour' && review.data.stops.length > 0 && <ol>
          {review.data.stops.map((stop) => <li key={stop.stop_id}>{stop.location} · {formatTime(stop.arrival_at)} – {formatTime(stop.departure_at)}</li>)}
        </ol>}
      </>}
      <details className="rv-terms"><summary>Điều khoản đặt xe</summary>
        <p>Đặt cọc để xác nhận giữ xe. Phần còn lại được thanh toán sau khi chuyến đi hoàn tất và có thể bao gồm chi phí phát sinh đã xác nhận.</p>
      </details>
      <label className="rv-check"><input type="checkbox" required checked={accepted}
        onChange={(event) => setAccepted(event.target.checked)}/> Tôi đồng ý với báo giá và điều khoản.</label>
      {error && <p className="rv-error" role="alert">{error}</p>}
      <button className="rv-button rv-primary" type="submit" disabled={!accepted || busy || !review.data}>
        {busy ? 'Đang xác nhận…' : 'Xác nhận báo giá'}
      </button>
    </form>
  );
}

