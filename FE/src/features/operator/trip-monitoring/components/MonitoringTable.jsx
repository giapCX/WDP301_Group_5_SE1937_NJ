import Icon from '../../../shared/booking/BookingIcon';
import BookingStatus from '../../../shared/booking/BookingStatus';
import { bookingCode, dateTime, BOOKING_STATUSES } from '../../../shared/booking/bookingConstants';
export default function MonitoringTable({ items, onSelect }) {
  if (!items.length)
    return (
      <div className="dispatch-empty">
        <Icon name="route" size={32} />
        <h3>Không có chuyến phù hợp</h3>
        <p>Chọn trạng thái khác để xem lịch trình.</p>
      </div>
    );
  return (
    <div className="booking-table-scroll">
      <table className="booking-table">
        <thead>
          <tr>
            <th>Chuyến / Khách hàng</th>
            <th>Xe & tài xế</th>
            <th>Lộ trình</th>
            <th>Trạng thái booking</th>
            <th>Cập nhật gần nhất</th>
            <th className="action-heading">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ booking, assignment, latest_update }) => (
            <tr key={booking.booking_id}>
              <td>
                <button
                  className="booking-code"
                  onClick={() => onSelect(booking.booking_id)}
                >
                  {bookingCode(booking.booking_id)}
                </button>
                <small>{booking.renter?.full_name || 'Chưa có thông tin khách'}</small>
              </td>
              <td>
                <strong>
                  {booking.vehicle
                    ? `${booking.vehicle.brand} ${booking.vehicle.model}`
                    : 'Chưa gán xe'}
                </strong>
                <small>{booking.vehicle?.plate_number}</small>
                <span className="monitor-driver">
                  <Icon name="user" size={12} />
                  {assignment?.driver?.user?.full_name || 'Chưa phân công tài xế'}
                </span>
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
                <BookingStatus status={booking.booking_status} />
              </td>
              <td>
                {latest_update ? (
                  <>
                    <strong>
                      {BOOKING_STATUSES[latest_update.trip_status]?.label ||
                        latest_update.trip_status}
                    </strong>
                    <small>{dateTime(latest_update.updated_at)}</small>
                    <small>Người cập nhật #{latest_update.updated_by}</small>
                  </>
                ) : (
                  <span className="monitor-no-update">Chưa có cập nhật</span>
                )}
              </td>
              <td className="action-cell">
                <button
                  className="dispatch-button compact primary"
                  onClick={() => onSelect(booking.booking_id)}
                >
                  Theo dõi
                  <Icon name="chevron" size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
