import Icon from '../../bookings/components/BookingIcon';

export default function GarageTaskFilters({ query, onChange }) {
  return (
    <section className="booking-filter-fields garage-task-filters" aria-label="Lọc nhiệm vụ Gara">
      <label className="booking-search">
        <Icon name="search" size={17} />
        <input
          aria-label="Tìm nhiệm vụ Gara"
          placeholder="Tìm booking, xe, biển số hoặc tài xế…"
          value={query}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {query && (
        <button className="dispatch-button subtle compact" onClick={() => onChange('')}>
          Xóa tìm kiếm
        </button>
      )}
    </section>
  );
}
