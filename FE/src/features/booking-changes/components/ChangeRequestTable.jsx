import Icon from '../../bookings/components/BookingIcon';
import { bookingCode, dateTime, money } from '../../bookings/bookingConstants';
import { requestCode } from '../changeConstants';
import ChangeStatus from './ChangeStatus';

export default function ChangeRequestTable({
  items,
  loading,
  error,
  selectedId,
  onSelect,
  onRetry,
}) {
  if (loading)
    return (
      <div className="dispatch-empty" role="status">
        Đang tải yêu cầu đổi lịch…
      </div>
    );
  if (error)
    return (
      <div className="dispatch-empty" role="alert">
        <h3>Chưa tải được yêu cầu</h3>
        <p>{error}</p>
        <button className="dispatch-button primary" onClick={onRetry}>
          Thử lại
        </button>
      </div>
    );
  if (!items.length)
    return (
      <div className="dispatch-empty">
        <Icon name="calendar" size={30} />
        <h3>Không có yêu cầu phù hợp</h3>
        <p>Thử chọn trạng thái khác hoặc bỏ lọc mã booking.</p>
      </div>
    );
  return (
    <div className="booking-table-scroll">
      <table className="booking-table change-table">
        <thead>
          <tr>
            <th>Yêu cầu / Booking</th>
            <th>Người yêu cầu</th>
            <th>Lý do thay đổi</th>
            <th>Chênh lệch giá</th>
            <th>Trạng thái</th>
            <th className="action-heading">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.change_request_id}
              className={selectedId === item.change_request_id ? 'selected-change' : ''}
            >
              <td>
                <button
                  className="booking-code"
                  onClick={() => onSelect(item.change_request_id)}
                >
                  {requestCode(item.change_request_id)}
                </button>
                <small>{bookingCode(item.booking_id)}</small>
              </td>
              <td>
                <strong>
                  {item.requester?.full_name || `Khách #${item.requested_by}`}
                </strong>
                <small>{dateTime(item.requested_at)}</small>
              </td>
              <td className="change-reason">{item.reason}</td>
              <td>
                <strong
                  className={
                    item.price_difference > 0 ? 'change-increase' : 'change-decrease'
                  }
                >
                  {item.price_difference > 0 ? '+' : ''}
                  {money(item.price_difference)}
                </strong>
                <small>Đề xuất</small>
              </td>
              <td>
                <ChangeStatus status={item.request_status} />
              </td>
              <td className="action-cell">
                <button
                  className={`dispatch-button compact ${item.request_status === 'pending' ? 'primary' : 'subtle'}`}
                  onClick={() => onSelect(item.change_request_id)}
                >
                  Xem yêu cầu
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
