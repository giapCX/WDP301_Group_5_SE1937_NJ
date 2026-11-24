import { Link } from 'react-router-dom';
import Icon from '../../bookings/components/BookingIcon';
import { DispatchSidebar } from '../../bookings/components/BookingSidebar';
import { GARAGE_TASKS_PATH, GARAGE_TASK_VIEWS } from '../garageConstants';

export default function GarageSidebar({ activeView }) {
  return (
    <DispatchSidebar home={GARAGE_TASKS_PATH} caption="NHÂN VIÊN GARA" navigationLabel="Điều hướng Gara">
      {GARAGE_TASK_VIEWS.map((view) => (
        <Link key={view.key} to={GARAGE_TASKS_PATH + view.search}
          className={view === activeView ? 'active' : undefined}
          aria-current={view === activeView ? 'page' : undefined}
          aria-label={view.label} title={view.label}>
          <Icon name={view.icon} />{view.label}
        </Link>
      ))}
    </DispatchSidebar>
  );
}
