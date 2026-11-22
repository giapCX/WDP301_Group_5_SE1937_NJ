import Icon from './BookingIcon';

export default function BookingStats({ counts }) {
  const cards = [
    {
      label: 'Tổng số booking',
      value: counts[''],
      icon: 'car',
      tone: 'blue',
      note: 'Tất cả yêu cầu đặt xe',
    },
    {
      label: 'Chờ xét duyệt',
      value: counts.pending,
      icon: 'calendar',
      tone: 'red',
      note: 'Cần được xử lý',
    },
    {
      label: 'Đang di chuyển',
      value: counts.in_progress,
      icon: 'route',
      tone: 'purple',
      note: 'Hành trình đang diễn ra',
    },
    {
      label: 'Chuyến hoàn thành',
      value: counts.completed,
      icon: 'check',
      tone: 'teal',
      note: 'Đã kết thúc hành trình',
    },
  ];
  return (
    <section className="dispatch-stats" aria-label="Thống kê booking">
      {cards.map((card) => (
        <article className={`stat-card tone-${card.tone}`} key={card.label}>
          <div>
            <p>{card.label}</p>
            <strong>{card.value ?? '—'}</strong>
          </div>
          <span className="stat-icon">
            <Icon name={card.icon} size={21} />
          </span>
          <span className="stat-note">
            <i />
            {card.note}
          </span>
        </article>
      ))}
    </section>
  );
}
