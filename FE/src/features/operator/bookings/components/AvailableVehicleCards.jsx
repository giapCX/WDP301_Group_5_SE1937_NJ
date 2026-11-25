import { useEffect, useState } from 'react';
import {
  fetchAvailableVehicles,
  fetchBookings,
  getBookingError,
} from '../api/bookingApi';
import { bookingCode, money } from '../../../shared/booking/bookingConstants';
import Icon from '../../../shared/booking/BookingIcon';

export function VehicleIllustration({ vehicle }) {
  const isVan = vehicle.seat_count > 7;
  return (
    <svg
      className="vehicle-illustration"
      viewBox="0 0 240 95"
      role="img"
      aria-label={`${vehicle.brand} ${vehicle.model}`}
    >
      <ellipse cx="123" cy="79" rx="92" ry="7" fill="#d9e1ec" />
      <path
        d={
          isVan
            ? 'M28 59V30q0-9 12-9h132q14 0 22 15l17 25v12H28z'
            : 'M24 61l12-12 38-7 25-24h57l32 30 26 10v15H24z'
        }
        fill={isVan ? '#c5d7e4' : '#dbe5ed'}
        stroke="#829bad"
        strokeWidth="2"
      />
      <path
        d={
          isVan
            ? 'M43 29h32v22H43z M82 29h32v22H82z M121 29h32v22h-32z M160 29h15l16 22h-31z'
            : 'M83 42l21-18h24v18z M135 24h18l22 18h-40z'
        }
        fill="#21445d"
      />
      <path
        d="M31 59h12 M196 59h12"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M91 55h10 M142 55h10 M90 47v20 M137 47v20"
        stroke="#91a5b5"
        strokeWidth="1.5"
      />
      <path d="M34 72h170" stroke="#405c72" strokeWidth="4" />
      <circle cx="64" cy="73" r="13" fill="#20394e" />
      <circle cx="64" cy="73" r="7" fill="#b2c1d0" />
      <circle cx="177" cy="73" r="13" fill="#20394e" />
      <circle cx="177" cy="73" r="7" fill="#b2c1d0" />
    </svg>
  );
}

export default function AvailableVehicleCards({ revision, onSelect }) {
  const [vehicles, setVehicles] = useState([]);
  const [bookingId, setBookingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    (async () => {
      try {
        const result = await fetchBookings(
          { status: 'pending', limit: 1 },
          controller.signal,
        );
        const id = result.items[0]?.booking_id;
        const available = id ? await fetchAvailableVehicles(id, controller.signal) : [];
        if (!controller.signal.aborted) {
          setBookingId(id);
          setVehicles(available);
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(getBookingError(failure));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [revision]);

  return (
    <section className="available-section" id="available-vehicles">
      <div className="section-heading">
        <div>
          <h2>
            <Icon name="car" />
            Xe phù hợp để điều phối
          </h2>
          <p>
            {bookingId
              ? `Gợi ý cho booking ${bookingCode(bookingId)} · Theo thời gian chuyến đi`
              : 'Xe được gợi ý theo lịch của booking chờ duyệt.'}
          </p>
        </div>
        {bookingId && !loading && !error && (
          <button className="text-button" onClick={() => onSelect(bookingId)}>
            Xem tất cả ({vehicles.length})<Icon name="arrow" size={16} />
          </button>
        )}
      </div>
      {loading ? (
        <div className="vehicle-loading" role="status">
          Đang tìm xe phù hợp…
        </div>
      ) : error ? (
        <div className="dispatch-alert" role="alert">
          {error}
        </div>
      ) : !vehicles.length ? (
        <div className="vehicle-loading">
          {bookingId
            ? 'Chưa có xe phù hợp với lịch chuyến này.'
            : 'Không có booking đang chờ duyệt.'}
        </div>
      ) : (
        <div className="vehicle-cards">
          {vehicles.slice(0, 3).map((vehicle) => (
            <button
              className="vehicle-card"
              key={vehicle.vehicle_id}
              onClick={() => onSelect(bookingId)}
            >
              <div className="vehicle-card-top">
                <div className="vehicle-art">
                  <VehicleIllustration vehicle={vehicle} />
                </div>
                <span className="vehicle-seats">{vehicle.seat_count} CHỖ</span>
              </div>
              <div className="vehicle-card-info">
                <strong>
                  {vehicle.brand} {vehicle.model}
                </strong>
                <span>Biển số: {vehicle.plate_number}</span>
              </div>
              <div className="vehicle-card-bottom">
                <span>
                  <i />
                  Phù hợp lịch chuyến
                </span>
                <strong>
                  {money(vehicle.price_per_day)}
                  <small>/ngày</small>
                </strong>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
