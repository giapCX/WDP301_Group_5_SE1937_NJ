import { DASHBOARD_PERIODS } from '../managerDashboardConfig';
import ManagerIcon from './ManagerIcon';

export default function ManagerTopbar({ month, year, onMonthChange, onYearChange, onRefresh, user, alertCount = 0 }) {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, index) => currentYear - 2 + index);
  return (
    <header className="manager-topbar">
      <div className="manager-breadcrumb"><span>Điều hành</span><b>›</b><strong>Quản lý đội xe &amp; vận hành</strong></div>
      <div className="manager-top-actions">
        <label className="manager-month-select"><span className="sr-only">Chọn tháng</span><select value={month} onChange={(event) => onMonthChange(Number(event.target.value))}>{DASHBOARD_PERIODS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}</select></label>
        <label className="manager-year-select"><span className="sr-only">Chọn năm</span><select value={year} onChange={(event) => onYearChange(Number(event.target.value))}>{yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        <button className="manager-top-icon manager-notification" type="button" aria-label={`Làm mới dữ liệu, ${alertCount} cảnh báo`} onClick={onRefresh}><ManagerIcon name="bell" size={16}/>{alertCount > 0 && <i/>}</button>
        <span className="manager-top-divider"/>
        <div className="manager-user"><span className="manager-user-avatar">{user?.full_name?.slice(0, 1) || 'M'}</span><span><b>{user?.full_name || 'Quản lý'}</b><small>Manager</small></span></div>
      </div>
    </header>
  );
}
