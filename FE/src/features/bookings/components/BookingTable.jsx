import Icon from './BookingIcon';
import BookingStatus from './BookingStatus';
import { bookingCode, dateTime, money } from '../bookingConstants';

export default function BookingTable({ items, loading, error, onRetry, onSelect }) {
  if (error)
    return (
      <div className="dispatch-empty" role="alert">
        <Icon name="help" size={30} />
        <h3>Chưa tải được danh sách</h3>
        <p>{error}</p>
        <button className="dispatch-button primary" onClick={onRetry}>
          Thử lại
        </button>
      </div>
    );
  if (loading)
    return (
      <div className="table-skeleton" aria-label="Đang tải booking" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  if (!items.length)
    return (
      <div className="dispatch-empty">
        <Icon name="calendar" size={34} />
        <h3>Chưa có chuyến đi nào</h3>
        <p>Không có booking phù hợp với bộ lọc hiện tại.</p>
      </div>
    );

  return (
    <div className="booking-table-scroll">
      <table className="booking-table">
        <thead>
          <tr>
            <th>Mã booking</th>
            <th>Khách hàng</th>
            <th>Lộ trình & thời gian</th>
            <th>Xe phụ trách</th>
            <th>Giá dự kiến</th>
            <th>Trạng thái</th>
            <th className="action-heading">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {items.map((booking) => (
            <tr key={booking.booking_id}>
              <td>
                <button
                  className="booking-code"
                  onClick={() => onSelect(booking.booking_id)}
                >
                  {bookingCode(booking.booking_id)}
                </button>
              </td>
              <td>
                <strong>
                  {booking.renter?.full_name || `Khách #${booking.renter_id}`}
                </strong>
                <small>
                  {booking.renter?.phone || booking.renter?.email || 'Chưa có liên hệ'}
                </small>
              </td>
              <td className="itinerary-cell">
                <span className="route-location">
                  <i />
                  {booking.pickup_location}
                </span>
                <span className="route-location destination">
                  <i />
                  {booking.dropoff_location}
                </span>
                <small>{dateTime(booking.pickup_time)}</small>
                <small>Đến {dateTime(booking.estimated_end_time)}</small>
              </td>
              <td>
                <small>
                  Yêu cầu:{' '}
                  {booking.requested_seat_count
                    ? `${booking.requested_seat_count} chỗ`
                    : 'Chưa có số chỗ'}
                </small>
                {booking.vehicle ? (
                  <>
                    <strong>
                      {booking.vehicle.brand} {booking.vehicle.model}
                    </strong>
                    <small>{booking.vehicle.plate_number}</small>
                    <span className="seat-label">{booking.vehicle.seat_count} chỗ</span>
                  </>
                ) : (
                  <span className="unassigned">
                    <Icon name="car" size={14} />
                    Chưa gán xe
                  </span>
                )}
              </td>
              <td>
                <strong className="price-value">{money(booking.estimated_price)}</strong>
                {booking.additional_charge > 0 && (
                  <small>+ {money(booking.additional_charge)}</small>
                )}
              </td>
              <td>
                <BookingStatus status={booking.booking_status} />
              </td>
              <td className="action-cell">
                <button
                  className={`dispatch-button compact ${booking.booking_status === 'pending' ? 'primary' : 'subtle'}`}
                  onClick={() => onSelect(booking.booking_id)}
                >
                  {booking.booking_status === 'pending' ? (
                    <>
                      <Icon name="list" size={14} />
                      Xét duyệt
                    </>
                  ) : (
                    <>
                      Chi tiết
                      <Icon name="chevron" size={13} />
                    </>
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
