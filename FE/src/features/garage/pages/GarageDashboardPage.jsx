import { useState } from 'react';
import Icon from '../../bookings/components/BookingIcon';
import { DispatchSidebar } from '../../bookings/components/BookingSidebar';
import { DispatchStats } from '../../bookings/components/BookingStats';
import GarageTaskTable from '../components/GarageTaskTable';
import { DEMO_GARAGE_TASKS, TASK_STATUSES, TASK_TYPES } from '../data/garageTasks';
import '../../bookings/styles/bookings.css';
import '../styles/garage.css';

const garageDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const dayInMs = 24 * 60 * 60 * 1000;

export default function GarageDashboardPage() {
  const now = Date.now();
  const today = garageDate.format(now);
  const [date, setDate] = useState(today);
  const [type, setType] = useState('ALL');
  const [query, setQuery] = useState('');

  const dailyTasks = DEMO_GARAGE_TASKS.filter(
    (task) => garageDate.format(now + (task.dayOffset ?? 0) * dayInMs) === date,
  );
  const search = query.trim().toLocaleLowerCase('vi');
  const visibleTasks = dailyTasks.filter((task) => {
    const text = [task.id, task.vehicle, task.plate, task.booking, task.driver].join(' ');
    return (type === 'ALL' || task.type === type) && text.toLocaleLowerCase('vi').includes(search);
  });
  const cards = [
    { label: 'Tổng nhiệm vụ', icon: 'list', tone: 'blue', value: dailyTasks.length },
    ...Object.entries(TASK_STATUSES).map(([status, card]) => ({
      ...card,
      value: dailyTasks.filter((task) => task.status === status).length,
    })),
  ];

  function resetFilters() {
    setDate(today);
    setType('ALL');
    setQuery('');
  }

  return (
    <div className="dispatch-app garage-dashboard" id="garage-overview">
      <DispatchSidebar
        home="/garage/tasks"
        caption="NHÂN VIÊN GARA"
        navigationLabel="Điều hướng gara"
      >
        <a href="#garage-overview" className="active">
          <Icon name="grid" />
          Tổng quan
        </a>
        <a href="#garage-task-list">
          <Icon name="list" />
          Danh sách nhiệm vụ
        </a>
      </DispatchSidebar>
      <div className="dispatch-workspace">
        <header className="dispatch-topbar">
          <div className="dispatch-breadcrumb">
            Gara <Icon name="chevron" size={11} /> <strong>Tổng quan</strong>
          </div>
          <div className="operator-profile">
            <span className="profile-avatar"><Icon name="user" /></span>
            <span><strong>Garage Staff</strong></span>
          </div>
        </header>
        <main className="dispatch-content">
          <header className="dispatch-page-heading">
            <div>
              <span className="garage-demo-label">Dữ liệu mẫu</span>
              <h1>Nhiệm vụ gara</h1>
              <p>Theo dõi lịch kiểm tra, giao nhận và bảo dưỡng xe.</p>
            </div>
            <label className="garage-date">
              Ngày làm việc
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value || today)}
              />
            </label>
          </header>
          <DispatchStats cards={cards} label="Thống kê nhiệm vụ theo ngày" />
          <section className="dispatch-filters" aria-label="Lọc nhiệm vụ gara">
            <div className="booking-tabs" role="group" aria-label="Loại nhiệm vụ">
              {Object.entries(TASK_TYPES).map(([key, label]) => (
                <button
                  key={key}
                  className={type === key ? 'is-active' : ''}
                  aria-pressed={type === key}
                  onClick={() => setType(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="booking-filter-fields">
              <label className="booking-search">
                <Icon name="search" size={17} />
                <input
                  aria-label="Tìm nhiệm vụ gara"
                  placeholder="Tìm mã nhiệm vụ, tên xe, biển số hoặc tài xế…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              {query && (
                <button className="dispatch-button subtle compact" onClick={() => setQuery('')}>
                  Xóa tìm kiếm
                </button>
              )}
            </div>
          </section>
          <section className="booking-list-panel" id="garage-task-list" aria-labelledby="garage-list-heading">
            <div className="section-heading table-heading">
              <h2 id="garage-list-heading"><Icon name="list" /> Nhiệm vụ được giao</h2>
              <span role="status">{visibleTasks.length} / {dailyTasks.length} nhiệm vụ</span>
            </div>
            <GarageTaskTable tasks={visibleTasks} onReset={resetFilters} />
          </section>
        </main>
      </div>
    </div>
  );
}
