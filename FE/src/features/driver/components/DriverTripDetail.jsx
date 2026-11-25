import { useEffect, useRef, useState } from 'react';
import { driverError, fetchDriverTrip } from '../api/driverApi';
import Icon from '../../shared/booking/BookingIcon';
import BookingStatus from '../../shared/booking/BookingStatus';
import { bookingCode, dateTime, BOOKING_STATUSES } from '../../shared/booking/bookingConstants';

export default function DriverTripDetail({
  id,
  onClose,
  loadTrip = fetchDriverTrip,
  eyebrow = 'HÀNH TRÌNH CỦA BẠN',
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    loadTrip(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(driverError(failure));
      });
    return () => controller.abort();
  }, [id, revision, loadTrip]);
  function keys(event) {
    if (event.key === 'Escape') onClose();
    if (event.key === 'Tab') {
      const nodes = dialog.current.querySelectorAll('button:not(:disabled),a[href]');
      const first = nodes[0],
        last = nodes[nodes.length - 1];
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
  const trip = data?.booking;
  return (
    <div className="review-backdrop" onClick={onClose}>
      <section
        className="booking-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-trip-title"
        tabIndex={-1}
        ref={dialog}
        onKeyDown={keys}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="review-header">
          <div>
            <span className="section-eyebrow">{eyebrow}</span>
            <h2 id="driver-trip-title">{bookingCode(id)}</h2>
          </div>
          <button className="icon-button" aria-label="Đóng hành trình" onClick={onClose}>
            <Icon name="close" size={22} />
          </button>
        </header>
        <div className="review-body">
          {error ? (
            <div className="dispatch-alert" role="alert">
              {error}
              <button onClick={() => setRevision((value) => value + 1)}>Thử lại</button>
            </div>
          ) : !data ? (
            <div className="dispatch-empty" role="status">
              Đang tải hành trình…
            </div>
          ) : (
            <>
              <div className="review-status">
                <BookingStatus status={trip.booking_status} />
                <span>Giao chuyến: {dateTime(data.assigned_at)}</span>
              </div>
              {data.driver && (
                <section className="review-section">
                  <h3>
                    <Icon name="user" />
                    Tài xế phụ trách
                  </h3>
                  <strong>{data.driver.full_name}</strong>
                  {data.driver.phone && (
                    <p>
                      <a className="driver-phone" href={`tel:${data.driver.phone}`}>
                        {data.driver.phone}
                      </a>
                    </p>
                  )}
                </section>
              )}
              <section className="review-section">
                <h3>
                  <Icon name="user" />
                  Khách hàng
                </h3>
                <strong>{trip.renter?.full_name || 'Chưa có thông tin'}</strong>
                {trip.renter?.phone && (
                  <p>
                    <a className="driver-phone" href={`tel:${trip.renter.phone}`}>
                      {trip.renter.phone}
                    </a>
                  </p>
                )}
              </section>
              <section className="review-section">
                <h3>
                  <Icon name="car" />
                  Xe phục vụ
                </h3>
                <strong>
                  {trip.vehicle
                    ? `${trip.vehicle.brand} ${trip.vehicle.model}`
                    : 'Chưa gán xe'}
                </strong>
                <p>
                  {trip.vehicle?.plate_number}
                  {trip.vehicle && ` · ${trip.vehicle.seat_count} chỗ`}
                </p>
              </section>
              <section className="review-section">
                <h3>
                  <Icon name="route" />
                  Lịch trình chi tiết
                </h3>
                <div className="review-route">
                  <div>
                    <span>ĐIỂM ĐÓN</span>
                    <strong>{trip.pickup_location}</strong>
                    <p>{dateTime(trip.pickup_time)}</p>
                  </div>
                  {data.stops.map((stop) => (
                    <div key={stop.stop_id}>
                      <span>ĐIỂM DỪNG {stop.stop_order}</span>
                      <strong>{stop.location}</strong>
                      {stop.note && <p>{stop.note}</p>}
                    </div>
                  ))}
                  <div>
                    <span>ĐIỂM TRẢ</span>
                    <strong>{trip.dropoff_location}</strong>
                    <p>{dateTime(trip.estimated_end_time)}</p>
                  </div>
                </div>
              </section>
              <section className="review-section">
                <h3>
                  <Icon name="clock" />
                  Lịch sử trạng thái gần nhất
                </h3>
                {data.updates.length ? (
                  <ol className="driver-update-list">
                    {data.updates.map((update) => (
                      <li key={update.update_id}>
                        <strong>
                          {BOOKING_STATUSES[update.trip_status]?.label ||
                            update.trip_status}
                        </strong>
                        <span>{dateTime(update.updated_at)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Chưa có cập nhật trạng thái cho chuyến này.</p>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
