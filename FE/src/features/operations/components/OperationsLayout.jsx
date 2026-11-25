import { useOutletContext } from 'react-router-dom';
import BookingSidebar from '../../shared/booking/BookingSidebar';
import OperatorTopbar from '../../operator/OperatorTopbar';
import ManagerSidebar from '../../manager-dashboard/components/ManagerSidebar';
import SignOutButton from '../../auth/components/SignOutButton';
import '../../shared/booking/bookings.css';
import '../../manager-dashboard/styles/managerDashboard.css';
import '../styles/operations.css';
export default function OperationsLayout({ manager, title, children }) {
  const user = useOutletContext();
  if (manager) return <div className="manager-app"><ManagerSidebar/><main className="manager-main"><div className="manager-content"><header className="op-heading"><h1>{title}</h1><SignOutButton/></header>{children}</div></main></div>;
  return <div className="dispatch-app"><BookingSidebar/><div className="dispatch-workspace"><OperatorTopbar title={title} user={user}/><main className="dispatch-content"><h1>{title}</h1>{children}</main></div></div>;
}
