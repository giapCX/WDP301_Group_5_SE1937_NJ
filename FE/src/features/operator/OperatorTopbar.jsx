import Icon from '../shared/booking/BookingIcon';
import SignOutButton from '../auth/components/SignOutButton.js';

export default function OperatorTopbar({ title, user }) {
  return (
    <header className="dispatch-topbar">
      <div className="dispatch-breadcrumb">
        Trang chủ <Icon name="chevron" size={11} /> Điều hành{' '}
        <Icon name="chevron" size={11} />
        <strong>{title}</strong>
      </div>
      <div className="operator-topbar-actions">
        <div className="operator-profile">
          <span className="profile-avatar">
            <Icon name="user" size={18} />
          </span>
          <span>
            <strong>{user?.full_name || 'Operator Staff'}</strong>
            <small>{user?.role_name || 'Trung tâm điều hành'}</small>
          </span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
