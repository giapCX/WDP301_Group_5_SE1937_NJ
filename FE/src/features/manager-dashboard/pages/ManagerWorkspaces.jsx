import ManagerIcon from '../components/ManagerIcon';
import MetricCard from '../components/MetricCard';
import RevenueChart from '../components/RevenueChart';
import { formatCurrency, formatPercent } from '../utils/managerDashboardFormatters';

function ScreenPanel({ title, description, icon, children }) {
  return <section className="manager-panel manager-screen-panel">
    <div className="manager-panel-heading"><div className="manager-screen-panel-title">
      {icon && <span className="manager-screen-icon"><ManagerIcon name={icon} size={15}/></span>}
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
    </div></div>{children}
  </section>;
}

function EmptyRow({ colSpan, children }) {
  return <tr><td colSpan={colSpan}><div className="manager-empty-state">{children}</div></td></tr>;
}

export function RevenueWorkspace({ data }) {
  const metrics = data?.metrics || {};
  const trend = data?.revenueTrend || [];
  const financials = data?.financials || {};
  const averagePayment = metrics.paidPaymentCount ? metrics.revenue / metrics.paidPaymentCount : 0;

  return <>
    <section className="manager-metrics manager-screen-metrics">
      <MetricCard label="BOOKING TRONG KỲ" value={`${metrics.bookingCount || 0}`} detail="Booking chưa đóng trong tháng" icon="calendar" tone="blue"/>
      <MetricCard label="DOANH THU ĐÃ THU" value={formatCurrency(metrics.revenue)} detail="Giao dịch đã thanh toán trong kỳ" icon="chart" tone="teal"/>
      <MetricCard label="GIAO DỊCH ĐÃ THANH TOÁN" value={`${metrics.paidPaymentCount || 0}`} detail="Trong kỳ đang chọn" icon="check" tone="indigo"/>
      <MetricCard label="HOÀN TIỀN ĐÃ XỬ LÝ" value={formatCurrency(financials.completedRefundAmount)} detail={`${financials.completedRefundCount || 0} khoản · mọi kỳ`} icon="alert" tone="orange"/>
    </section>
    <section className="manager-finance-chart-grid">
      <RevenueChart items={trend} year={data?.period?.year} month={data?.period?.month}/>
      <ScreenPanel title="Tổng hợp dòng tiền" description="Khoản thu và hoàn tiền có trong dữ liệu." icon="chart">
        <div className="manager-finance-summary">
          <div><span>Thu đã thanh toán trong kỳ</span><b>{formatCurrency(metrics.revenue)}</b></div>
          <div><span>Số giao dịch</span><b>{metrics.paidPaymentCount || 0}</b></div>
          <div><span>Giá trị thanh toán trung bình</span><b>{formatCurrency(averagePayment)}</b></div>
          <div><span>Hoàn tiền đã xử lý, mọi kỳ</span><b>{formatCurrency(financials.completedRefundAmount)}</b></div>
        </div>
        <p className="manager-screen-note">Báo cáo dùng dữ liệu thanh toán đã ghi nhận; không ước tính chi phí khi hệ thống chưa có dữ liệu nguồn.</p>
      </ScreenPanel>
    </section>
    <ScreenPanel title="Doanh thu & booking theo tuần" description="Đối chiếu booking và khoản thu đã thanh toán trong tháng." icon="calendar">
      <div className="manager-table-wrap"><table className="manager-fleet-table manager-finance-table">
        <thead><tr><th>GIAI ĐOẠN</th><th>BOOKING</th><th>DOANH THU</th><th>TỶ TRỌNG DOANH THU</th></tr></thead>
        <tbody>{trend.map((item) => {
          const share = metrics.revenue ? (item.revenue / metrics.revenue) * 100 : 0;
          return <tr key={item.key}><td><b>{item.label}</b></td><td>{item.bookings}</td><td>{formatCurrency(item.revenue)}</td>
            <td><span className="manager-finance-share"><i style={{ width: `${Math.min(100, share)}%` }}/></span><small>{formatPercent(share)}</small></td></tr>;
        })}{!trend.length && <EmptyRow colSpan={4}>Chưa có dữ liệu trong kỳ.</EmptyRow>}</tbody>
      </table></div>
    </ScreenPanel>
  </>;
}
