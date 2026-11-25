import { dateTime, money } from '../../bookings/bookingConstants';

function stopText(stops = []) {
  return (
    [...stops]
      .sort((a, b) => a.stop_order - b.stop_order)
      .map(
        (stop) =>
          `${stop.stop_order}. ${stop.location}${stop.note ? ` — ${stop.note}` : ''}${stop.arrival_at ? ' · Đến ' + dateTime(stop.arrival_at) : ''}${stop.departure_at ? ' · Rời ' + dateTime(stop.departure_at) : ''}`,
      )
      .join('\n') || 'Không có điểm dừng'
  );
}

export default function ItineraryComparison({ before, after }) {
  const fields = [
    ['pickup_location', 'Điểm đón', (value) => value],
    ['destination', 'Điểm du lịch', (value) => value || '—'],
    ['return_pickup_location', 'Điểm đón về', (value) => value || '—'],
    ['return_pickup_time', 'Giờ đón về', dateTime],
    ['dropoff_location', 'Điểm trả', (value) => value],
    ['pickup_time', 'Giờ đón', dateTime],
    ['estimated_end_time', 'Giờ kết thúc', dateTime],
    ['trip_stops', 'Điểm tham quan', stopText],
    ['estimated_price', 'Giá dự kiến', money],
  ];
  return (
    <div className="comparison-scroll">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Nội dung</th>
            <th>
              <span className="comparison-label">TRƯỚC THAY ĐỔI</span>Lịch đã ghi nhận
            </th>
            <th>
              <span className="comparison-label">SAU THAY ĐỔI</span>Lịch đề xuất
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map(([key, label, format]) => {
            const oldValue = format(before[key]);
            const newValue = format(after[key]);
            const changed = oldValue !== newValue;
            return (
              <tr key={key} className={changed ? 'comparison-changed' : ''}>
                <th>
                  {label}
                  {changed && <small>Có thay đổi</small>}
                </th>
                <td>{oldValue}</td>
                <td>{newValue}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
