import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { bookingCode } from '../../bookings/bookingConstants';
import Icon from '../../bookings/components/BookingIcon';
import GarageTaskFilters from '../components/GarageTaskFilters';
import GarageTaskStats from '../components/GarageTaskStats';
import GarageTaskTable from '../components/GarageTaskTable';
import useGarageTasks from '../hooks/useGarageTasks';

const DEFAULT_FILTERS = { date: '', query: '' };

function matchesSearch(task, query) {
  const { vehicle, driver, maintenance } = task;
  const text = [
    task.id, task.booking_id && bookingCode(task.booking_id), vehicle?.brand, vehicle?.model,
    vehicle?.plate_number, driver?.full_name, maintenance?.description,
  ];
  return text.join(' ').toLocaleLowerCase('vi').includes(query);
}

export default function GarageDashboardPage() {
  const view = useOutletContext();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { tasks, loading, error, refresh } = useGarageTasks(filters.date);
  const query = filters.query.trim().toLocaleLowerCase('vi');
  const viewTasks = view.type ? tasks.filter((task) => task.type === view.type) : tasks;
  const visible = viewTasks.filter((task) => matchesSearch(task, query));
  const hasFilters = Boolean(filters.date || query);
  const changeFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

  return (
    <>
      <header className="dispatch-page-heading" id="garage-overview">
        <div>
          <h1>{view.title || view.label}</h1>
          <p>{view.description}</p>
        </div>
        <div className="garage-page-actions">
          <button className="dispatch-button subtle" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={15} />Làm mới
          </button>
          <label className="garage-date">
            Lọc theo ngày
            <input type="date" value={filters.date} onChange={(event) => changeFilter('date', event.target.value)} />
          </label>
        </div>
      </header>
      {!view.type && <GarageTaskStats tasks={loading || error ? undefined : tasks} />}
      <section className="booking-list-panel" id="garage-task-list" aria-labelledby="garage-list-heading">
        <div className="section-heading table-heading">
          <h2 id="garage-list-heading"><Icon name="list" />Nhiệm vụ được giao</h2>
          {!loading && !error && viewTasks.length > 0 && (
            <span>{hasFilters ? `${visible.length} / ${viewTasks.length}` : visible.length} nhiệm vụ</span>
          )}
        </div>
        <GarageTaskFilters query={filters.query} onChange={(value) => changeFilter('query', value)} />
        <GarageTaskTable tasks={visible} loading={loading} error={error} hasFilters={hasFilters} view={view}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />
      </section>
    </>
  );
}
