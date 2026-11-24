import { NavLink, Outlet, useMatch, useOutletContext } from 'react-router-dom';
import SignOutButton from '../../auth/components/SignOutButton';
import Icon from '../../bookings/components/BookingIcon';
import { DispatchSidebar } from '../../bookings/components/BookingSidebar';
import { GARAGE_TASKS_PATH } from '../garageConstants';
import '../../bookings/styles/bookings.css';
import '../styles/garage.css';

export default function GarageLayout() {
  const user = useOutletContext();
  const dashboard = useMatch(GARAGE_TASKS_PATH);

  return (
    <div className="dispatch-app garage-dashboard">
      <DispatchSidebar home={GARAGE_TASKS_PATH} caption="NHÂN VIÊN GARA" navigationLabel="Điều hướng Gara">
        <NavLink to={GARAGE_TASKS_PATH}><Icon name="list" />Danh sách nhiệm vụ</NavLink>
      </DispatchSidebar>
      <div className="dispatch-workspace">
        <header className="dispatch-topbar">
          <div className="dispatch-breadcrumb">
            Gara <Icon name="chevron" size={11} />
            <strong>{dashboard ? 'Nhiệm vụ' : 'Chi tiết nhiệm vụ'}</strong>
          </div>
          <div className="garage-user-actions">
            <div className="operator-profile">
              <span className="profile-avatar"><Icon name="user" /></span>
              <span><strong>{user?.full_name || 'Tài khoản Gara'}</strong><small>Nhân viên Gara</small></span>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="dispatch-content"><Outlet /></main>
      </div>
    </div>
  );
}
