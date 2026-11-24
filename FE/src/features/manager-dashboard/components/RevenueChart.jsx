import { formatCompactCurrency, formatCurrency } from '../utils/managerDashboardFormatters';
import ManagerIcon from './ManagerIcon';

export default function RevenueChart({ items = [], year, month }) {
  const maxRevenue = Math.max(...items.map((item) => item.revenue || 0), 1);
  const maxBookings = Math.max(...items.map((item) => item.bookings || 0), 1);
  const totalRevenue = items.reduce((total, item) => total + Number(item.revenue || 0), 0);
  const totalBookings = items.reduce((total, item) => total + Number(item.bookings || 0), 0);

  return (
    <section className="manager-panel revenue-panel" id="manager-revenue">
      <div className="manager-panel-heading">
        <div><h2>Doanh thu &amp; Chuyến đi theo tuần</h2><p>Đối chiếu giao dịch đã thanh toán và booking trong tháng.</p></div>
        <div className="manager-chart-legend"><span><i className="legend-revenue"/> Doanh thu</span><span><i className="legend-bookings"/> Chuyến đi</span></div>
      </div>
      <div className="manager-chart-plot" role="img" aria-label={`Doanh thu và chuyến đi theo tuần trong tháng ${month}/${year}`}>
        <div className="manager-chart-y-labels"><span>{formatCompactCurrency(maxRevenue)}</span><span>{formatCompactCurrency(maxRevenue / 2)}</span><span>0 ₫</span></div>
        <div className="manager-chart-grid">
          <div className="manager-grid-line"/><div className="manager-grid-line"/><div className="manager-grid-line"/>
          <div className="manager-chart-columns">{items.map((item) => <div className="manager-chart-column" key={item.key} title={`${formatCurrency(item.revenue)} · ${item.bookings} chuyến`}>
            <div className="manager-chart-bars"><span className="manager-bar revenue-bar" style={{ height: `${Math.max(2, (item.revenue / maxRevenue) * 100)}%` }}/><span className="manager-bar bookings-bar" style={{ height: `${Math.max(2, (item.bookings / maxBookings) * 100)}%` }}/></div>
            <small>{item.label}</small>
          </div>)}</div>
        </div>
      </div>
      <div className="manager-chart-foot"><span><ManagerIcon name="chart" size={14}/> {totalBookings} chuyến trong tháng</span><b>{formatCompactCurrency(totalRevenue)}</b></div>
    </section>
  );
}
