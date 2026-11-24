import { useState } from 'react';
import Icon from '../../bookings/components/BookingIcon';
import GarageTaskFilters from '../components/GarageTaskFilters';
import GarageTaskStats from '../components/GarageTaskStats';
import GarageTaskTable from '../components/GarageTaskTable';
import useGarageTasks from '../hooks/useGarageTasks';

const DEFAULT_FILTERS = { date: '', type: 'ALL', query: '' };

function matchesTask(task, type, query) {
  if (type !== 'ALL' && task.type !== type) return false;
  const { vehicle, driver, maintenance } = task;
  const text = [
    task.id, task.booking_id, vehicle?.brand, vehicle?.model,
    vehicle?.plate_number, driver?.full_name, maintenance?.description,
  ];
  return text.join(' ').toLocaleLowerCase('vi').includes(query);
}

export default function GarageDashboardPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { tasks, loading, error, refresh } = useGarageTasks(filters.date);
  const query = filters.query.trim().toLocaleLowerCase('vi');
  const visible = tasks.filter((task) => matchesTask(task, filters.type, query));
  const changeFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

  return (
    <>
      <header className="dispatch-page-heading" id="garage-overview">
        <div>
          <h1>Nhiệm vụ Gara</h1>
          <p>Kiểm tra trước chuyến, tiếp nhận xe và theo dõi bảo dưỡng.</p>
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
      <GarageTaskStats tasks={tasks} />
      <GarageTaskFilters filters={filters} onChange={changeFilter} />
      <section className="booking-list-panel" id="garage-task-list" aria-labelledby="garage-list-heading">
        <div className="section-heading table-heading">
          <h2 id="garage-list-heading"><Icon name="list" />Nhiệm vụ được giao</h2>
          {!loading && !error && <span>{visible.length} / {tasks.length} nhiệm vụ</span>}
        </div>
        <GarageTaskTable tasks={visible} loading={loading} error={error}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />
      </section>
    </>
  );
}
