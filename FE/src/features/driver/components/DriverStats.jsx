import Icon from '../../shared/booking/BookingIcon';

export default function DriverStats({ stats }) {
  const cards = [
    ['total', 'Tổng chuyến phân công', 'car', 'blue', 'Tất cả chuyến của bạn'],
    ['upcoming', 'Sắp khởi hành', 'calendar', 'purple', 'Đã xác nhận, chưa đến giờ đón'],
    ['active', 'Đang thực hiện', 'route', 'teal', 'Chuyến đi đang diễn ra'],
    ['completed', 'Chuyến hoàn thành', 'check', 'blue', 'Hành trình đã kết thúc'],
  ];
  return (
    <section className="dispatch-stats" aria-label="Thống kê tài xế">
      {cards.map(([key, label, icon, tone, note]) => (
        <article className={`stat-card tone-${tone}`} key={key}>
          <div>
            <p>{label}</p>
            <strong>{stats?.[key] ?? '—'}</strong>
          </div>
          <span className="stat-icon">
            <Icon name={icon} size={21} />
          </span>
          <span className="stat-note">
            <i />
            {note}
          </span>
        </article>
      ))}
    </section>
  );
}
