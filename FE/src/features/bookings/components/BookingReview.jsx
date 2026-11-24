import { useEffect, useRef, useState } from 'react';
import useBookingReview from '../hooks/useBookingReview';
import BookingStatus from './BookingStatus';
import BookingQuoteForm from './BookingQuoteForm.jsx';
import Icon from './BookingIcon';
import { bookingCode, dateTime, money } from '../bookingConstants';

export default function BookingReview({ id, onClose, onUpdated }) {
  const review = useBookingReview(id, onUpdated);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const dialog = useRef(null);
  const { booking } = review;
  const canQuote = booking?.quote_requested_at && ['pending', 'quoted'].includes(booking.booking_status);
  const canComplete = booking?.quote_offer?.accepted_at && ['confirmed', 'in_progress'].includes(booking.booking_status) &&
    Date.parse(booking.estimated_end_time) <= Date.now();

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  function handleKeys(event) {
    if (event.key === 'Escape' && !review.saving) onClose();
    if (event.key === 'Tab') {
      const buttons = dialog.current.querySelectorAll(
        'button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea',
      );
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  async function submit(action) {
    if (await review.decide(action, reason)) onClose();
  }

  return (
    <div
      className="review-backdrop"
      onClick={() => {
        if (!review.saving) onClose();
      }}
    >
      <section
        className="booking-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        tabIndex={-1}
        ref={dialog}
        onKeyDown={handleKeys}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="review-header">
          <div>
            <span className="section-eyebrow">CHI TIẾT ĐẶT XE</span>
            <h2 id="review-title">{bookingCode(id)}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Đóng chi tiết"
            disabled={review.saving}
            onClick={onClose}
          >
            <Icon name="close" size={22} />
          </button>
        </header>
        <div className="review-body">
          {review.loading && (
            <div className="dispatch-empty" role="status">
              Đang tải thông tin chuyến đi…
            </div>
          )}
          {review.error && (
            <div className="dispatch-alert" role="alert">
              {review.error}
              <button onClick={review.reload} disabled={review.saving}>
                Tải lại
              </button>
            </div>
          )}
          {booking && (
            <>
              <div className="review-status">
                <BookingStatus status={booking.booking_status} />
                <span>Tạo lúc {dateTime(booking.created_at)}</span>
              </div>
              <section className="review-section">
                <h3>
                  <Icon name="user" />
                  Khách hàng
                </h3>
                <strong>
                  {booking.renter?.full_name || `Khách #${booking.renter_id}`}
                </strong>
                <p>
                  {booking.renter?.phone || 'Chưa có số điện thoại'}
                  <br />
                  {booking.renter?.email}
                </p>
              </section>
              <section className="review-section">
                <h3>
                  <Icon name="route" />
                  Lộ trình & thời gian
                </h3>
                {booking.passenger_count && <p>{booking.passenger_count} hành khách</p>}
                {booking.special_requests && <p>Yêu cầu bổ sung: {booking.special_requests}</p>}
                <div className="review-route">
                  <div>
                    <span>ĐIỂM ĐÓN</span>
                    <strong>{booking.pickup_location}</strong>
                    <p>{dateTime(booking.pickup_time)}</p>
                  </div>
                  {booking.trip_stops?.map((stop) => (
                    <div key={stop.stop_id}>
                      <span>ĐIỂM DỪNG {stop.stop_order}</span>
                      <strong>{stop.location}</strong>
                      {stop.arrival_at && <p>Đến {dateTime(stop.arrival_at)}</p>}
                      {stop.departure_at && <p>Rời {dateTime(stop.departure_at)}</p>}
                      {stop.note && <p>{stop.note}</p>}
                    </div>
                  ))}
                  <div>
                    <span>ĐIỂM TRẢ</span>
                    <strong>{booking.dropoff_location}</strong>
                    <p>{dateTime(booking.estimated_end_time)}</p>
                  </div>
                </div>
              </section>
              <section className="review-section">
                <h3>
                  <Icon name="car" />
                  Xe phụ trách
                </h3>
                {booking.booking_status === 'pending' && booking.requested_seats && !booking.quote_requested_at && (
                  <p>Yêu cầu xe từ {booking.requested_seats} chỗ. Hệ thống sẽ tự phân xe đủ chỗ và còn lịch khi duyệt.</p>
                )}
                {booking.booking_status === 'pending' && !booking.requested_seats && !booking.quote_requested_at && (
                  <>
                    <label className="review-label" htmlFor="review-vehicle">
                      Chọn xe phù hợp
                    </label>
                    <select
                      id="review-vehicle"
                      value={review.vehicleId}
                      disabled={
                        review.loading || review.saving || Boolean(review.vehiclesError)
                      }
                      onChange={(event) => review.setVehicleId(event.target.value)}
                    >
                      <option value="">Chọn xe để duyệt booking</option>
                      {review.vehicles.map((vehicle) => (
                        <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                          {vehicle.brand} {vehicle.model} · {vehicle.plate_number} ·{' '}
                          {vehicle.seat_count} chỗ
                        </option>
                      ))}
                    </select>
                    <p className="review-hint">
                      Xe được lọc theo tình trạng vận hành và lịch chuyến. Lịch sẽ được
                      kiểm tra lại khi duyệt.
                    </p>
                    {!review.loading &&
                      !review.vehiclesError &&
                      !review.vehicles.length && (
                        <p className="unassigned">
                          Không có xe phù hợp trong thời gian này.
                        </p>
                      )}
                    {review.vehiclesError && (
                      <div className="dispatch-alert" role="alert">
                        {review.vehiclesError}
                        <button onClick={review.reload} disabled={review.saving}>
                          Tải lại
                        </button>
                      </div>
                    )}
                  </>
                )}
                {booking.booking_status !== 'pending' && (
                  <p>
                    {booking.vehicle
                      ? `${booking.vehicle.brand} ${booking.vehicle.model} · ${booking.vehicle.plate_number}`
                      : 'Chưa gán xe'}
                  </p>
                )}
              </section>
              {(!booking.quote_requested_at || booking.pricing_breakdown) && <section className="review-section">
                <h3>Chi phí dự kiến</h3>
                <div className="cost-line">
                  <span>Giá chuyến đi</span>
                  <strong>{money(booking.estimated_price)}</strong>
                </div>
                <div className="cost-line">
                  <span>Phụ phí</span>
                  <strong>{money(booking.additional_charge)}</strong>
                </div>
                <div className="cost-line total">
                  <span>Tổng trước khuyến mãi</span>
                  <strong>
                    {money(booking.estimated_price + booking.additional_charge)}
                  </strong>
                </div>
              </section>}
              {canQuote && !rejecting && <BookingQuoteForm booking={booking} busy={review.saving}
                onSend={async (route) => { if (await review.decide('quote', route)) onClose(); }}/>}
              {booking.reviewed_at && (
                <section className="review-section">
                  <h3>Thông tin xử lý</h3>
                  <p>
                    {booking.reviewer?.full_name || `Nhân viên #${booking.reviewed_by}`} ·{' '}
                    {dateTime(booking.reviewed_at)}
                  </p>
                </section>
              )}
              {booking.rejection_reason && (
                <div className="dispatch-alert">
                  Lý do từ chối: {booking.rejection_reason}
                </div>
              )}
              {rejecting && (
                <section className="review-section">
                  <label className="review-label" htmlFor="rejection-reason">
                    Lý do từ chối <span>*</span>
                  </label>
                  <textarea
                    id="rejection-reason"
                    rows={4}
                    value={reason}
                    disabled={review.saving}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Nhập lý do để thông báo cho khách hàng…"
                  />
                </section>
              )}
            </>
          )}
        </div>
        {booking?.booking_status === 'pending' && (
          <footer className="review-actions">
            {rejecting ? (
              <>
                <button
                  className="dispatch-button subtle"
                  disabled={review.saving}
                  onClick={() => setRejecting(false)}
                >
                  Quay lại
                </button>
                <button
                  className="dispatch-button danger"
                  disabled={review.saving || !reason.trim()}
                  onClick={() => submit('reject')}
                >
                  {review.saving ? 'Đang xử lý…' : 'Xác nhận từ chối'}
                </button>
              </>
            ) : (
              <>
                <button
                  className="dispatch-button outline-danger"
                  disabled={review.saving || review.loading}
                  onClick={() => setRejecting(true)}
                >
                  Từ chối
                </button>
                {!booking.quote_requested_at && <button
                  className="dispatch-button primary"
                  disabled={
                    review.saving ||
                    review.loading ||
                    (!booking.requested_seats && !review.vehicleId) ||
                    Boolean(review.vehiclesError)
                  }
                  onClick={() => submit('approve')}
                >
                  <Icon name="check" />
                  {review.saving ? 'Đang xử lý…' : booking.requested_seats ? 'Duyệt và phân xe' : 'Duyệt booking'}
                </button>}
              </>
            )}
          </footer>
        )}
        {canComplete && <footer className="review-actions">
          <button className="dispatch-button primary" type="button" disabled={review.saving}
            onClick={() => submit('complete')}>Hoàn tất chuyến và mở thanh toán còn lại</button>
        </footer>}
      </section>
    </div>
  );
}
