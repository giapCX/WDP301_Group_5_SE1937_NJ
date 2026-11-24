import Icon from '../../bookings/components/BookingIcon';
import { TASK_TYPES } from '../garageConstants';

const TYPES = { ALL: 'Tất cả', ...TASK_TYPES };

export default function GarageTaskFilters({ filters, onChange }) {
  return (
    <section className="dispatch-filters" aria-label="Lọc nhiệm vụ Gara">
      <div className="booking-tabs" role="group" aria-label="Loại nhiệm vụ">
        {Object.entries(TYPES).map(([type, label]) => (
          <button
            key={type}
            className={filters.type === type ? 'is-active' : ''}
            aria-pressed={filters.type === type}
            onClick={() => onChange('type', type)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="booking-filter-fields">
        <label className="booking-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Tìm nhiệm vụ Gara"
            placeholder="Tìm booking, xe, biển số hoặc tài xế…"
            value={filters.query}
            onChange={(event) => onChange('query', event.target.value)}
          />
        </label>
        {filters.query && (
          <button className="dispatch-button subtle compact" onClick={() => onChange('query', '')}>
            Xóa tìm kiếm
          </button>
        )}
      </div>
    </section>
  );
}
