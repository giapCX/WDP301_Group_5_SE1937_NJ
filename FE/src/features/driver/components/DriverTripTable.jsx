import Icon from '../../bookings/components/BookingIcon';
import BookingStatus from '../../bookings/components/BookingStatus';
import { bookingCode, dateTime } from '../../bookings/bookingConstants';

export default function DriverTripTable({ rows, onSelect }) {
  if (!rows.length)
    return (
      <div className="dispatch-empty">
        <Icon name="calendar" size={32} />
        <h3>Chưa có chuyến phù hợp</h3>
        <p>Các chuyến được phân công sẽ xuất hiện tại đây.</p>
      </div>
    );
  return (
    <div className="booking-table-scroll">
      <table className="booking-table">
        <thead>
          <tr>
            <th>Mã chuyến</th>
            <th>Khách hàng</th>
            <th>Lộ trình & thời gian</th>
            <th>Xe được giao</th>
            <th>Trạng thái</th>
            <th className="action-heading">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const trip = row.booking;
            return (
              <tr key={row.assignment_id}>
                <td>
                  <button
                    className="booking-code"
                    onClick={() => onSelect(trip.booking_id)}
                  >
                    {bookingCode(trip.booking_id)}
                  </button>
                  <small>Phân công #{row.assignment_id}</small>
                </td>
                <td>
                  <strong>{trip.renter?.full_name || 'Chưa có thông tin'}</strong>
                  {trip.renter?.phone && (
                    <a className="driver-phone" href={`tel:${trip.renter.phone}`}>
                      {trip.renter.phone}
                    </a>
                  )}
                </td>
                <td className="itinerary-cell">
                  <span className="route-location">
                    <i />
                    {trip.pickup_location}
                  </span>
                  <span className="route-location destination">
                    <i />
                    {trip.dropoff_location}
                  </span>
                  <small>{dateTime(trip.pickup_time)}</small>
                  <small>Đến {dateTime(trip.estimated_end_time)}</small>
                </td>
                <td>
                  <strong>
                    {trip.vehicle
                      ? `${trip.vehicle.brand} ${trip.vehicle.model}`
                      : 'Chưa gán xe'}
                  </strong>
                  <small>{trip.vehicle?.plate_number}</small>
                  {trip.vehicle && (
                    <span className="seat-label">{trip.vehicle.seat_count} chỗ</span>
                  )}
                </td>
                <td>
                  <BookingStatus status={trip.booking_status} />
                </td>
                <td className="action-cell">
                  <button
                    className="dispatch-button compact subtle"
                    onClick={() => onSelect(trip.booking_id)}
                  >
                    Hành trình
                    <Icon name="chevron" size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
