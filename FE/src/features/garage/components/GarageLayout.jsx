import { Outlet, useLocation, useMatch, useOutletContext } from 'react-router-dom';
import SignOutButton from '../../auth/components/SignOutButton';
import Icon from '../../shared/booking/BookingIcon';
import { GARAGE_TASKS_PATH, getGarageTaskView } from '../garageConstants';
import GarageSidebar from './GarageSidebar';
import '../../shared/booking/bookings.css';
import '../styles/garage.css';

export default function GarageLayout() {
  const user = useOutletContext();
  const dashboard = useMatch(GARAGE_TASKS_PATH);
  const { search } = useLocation();
  const view = getGarageTaskView(search);

  return (
    <div className="dispatch-app garage-dashboard">
      <GarageSidebar activeView={view} />
      <div className="dispatch-workspace">
        <header className="dispatch-topbar">
          <div className="dispatch-breadcrumb">
            Gara <Icon name="chevron" size={11} />
            <strong>{dashboard ? view.title || view.label : 'Chi tiết nhiệm vụ'}</strong>
          </div>
          <div className="garage-user-actions">
            <div className="operator-profile">
              <span className="profile-avatar"><Icon name="user" /></span>
              <span><strong>{user?.full_name || 'Tài khoản Gara'}</strong><small>Nhân viên Gara</small></span>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="dispatch-content"><Outlet context={view} /></main>
      </div>
    </div>
  );
}
