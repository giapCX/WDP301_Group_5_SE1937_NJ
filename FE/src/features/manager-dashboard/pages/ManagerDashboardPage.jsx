import { useOutletContext } from 'react-router-dom';
import AlertsPanel from '../components/AlertsPanel';
import FleetStatusPanel from '../components/FleetStatusPanel';
import FleetTable from '../components/FleetTable';
import ManagerIcon from '../components/ManagerIcon';
import ManagerSidebar from '../components/ManagerSidebar';
import ManagerTopbar from '../components/ManagerTopbar';
import MetricCard from '../components/MetricCard';
import RevenueChart from '../components/RevenueChart';
import useManagerDashboard from '../hooks/useManagerDashboard';
import { exportManagerReport } from '../utils/exportManagerReport';
import { formatCurrency, formatPercent, monthLabel } from '../utils/managerDashboardFormatters';
import '../styles/managerDashboard.css';

export default function ManagerDashboardPage() {
  const user = useOutletContext();
  const dashboard = useManagerDashboard();
  const metrics = dashboard.data?.metrics;
  const periodLabel = monthLabel(dashboard.year, dashboard.month);

  return (
    <div className="manager-app">
      <ManagerSidebar activeHref="#manager-overview"/>
      <main className="manager-main">
        <ManagerTopbar
          month={dashboard.month}
          year={dashboard.year}
          onMonthChange={dashboard.setMonth}
          onYearChange={dashboard.setYear}
          onRefresh={dashboard.refresh}
          user={user}
          alertCount={dashboard.data?.alerts?.length || 0}
        />
        <div className="manager-content" id="manager-overview">
          <section className="manager-page-heading">
            <div>
              <div className="manager-eyebrow"><span/> TRUNG TÂM ĐIỀU HÀNH VẬN TẢI</div>
              <h1>Quản lý đội xe &amp; Hiệu suất vận hành</h1>
              <p>Dữ liệu tổng hợp từ phương tiện, booking, thanh toán và công việc vận hành.</p>
            </div>
            <div className="manager-heading-actions">
              <span className="manager-period-chip"><ManagerIcon name="clock" size={14}/>{periodLabel}</span>
              <button className="manager-button manager-button-outline" type="button" disabled={!dashboard.data?.vehicles?.length} onClick={() => exportManagerReport(dashboard.data.vehicles, dashboard.data.period)}><ManagerIcon name="download" size={15}/> Xuất CSV</button>
              <button className="manager-button manager-button-primary" type="button" onClick={dashboard.refresh}><ManagerIcon name="refresh" size={15}/> Làm mới dữ liệu</button>
            </div>
          </section>

          {dashboard.error && <div className="manager-feedback error" role="alert">{dashboard.error}<button type="button" onClick={dashboard.refresh}>Thử lại</button></div>}
          {dashboard.loading && !dashboard.data && <div className="manager-loading" role="status"><span/>Đang tải số liệu vận hành…</div>}
          {!dashboard.error && !dashboard.loading && !dashboard.data && <div className="manager-feedback" role="status">Chưa có dữ liệu để hiển thị.</div>}

          {dashboard.data && <>
            <section className="manager-metrics" aria-label="Chỉ số vận hành">
              <MetricCard label="TỔNG PHƯƠNG TIỆN" value={`${metrics.vehicleCount} xe`} detail={`${metrics.activeBookingCount} booking đang hoạt động`} icon="car" tone="blue"/>
              <MetricCard label="TỶ LỆ KHAI THÁC" value={formatPercent(metrics.utilizationRate)} detail={`${metrics.runningCount} xe đang có chuyến`} icon="chart" tone="teal" progress={metrics.utilizationRate}/>
              <MetricCard label="DOANH THU VẬN TẢI THÁNG" value={formatCurrency(metrics.revenue)} detail={`${metrics.paidPaymentCount} giao dịch đã thanh toán`} icon="chart" tone="indigo"/>
              <MetricCard label="TỶ LỆ XE SẴN SÀNG" value={formatPercent(metrics.availabilityRate)} detail={`${metrics.availableCount} xe sẵn sàng · ${metrics.bookingCount} booking tháng`} icon="check" tone="orange" progress={metrics.availabilityRate}/>
            </section>

            <section className="manager-analytics-grid">
              <RevenueChart items={dashboard.data.revenueTrend} year={dashboard.year} month={dashboard.month}/>
              <FleetStatusPanel statuses={dashboard.data.fleetStatus} totalVehicles={metrics.vehicleCount}/>
            </section>

            <FleetTable
                vehicles={dashboard.data.vehicles}
                statuses={dashboard.data.fleetStatus}
                selectedStatus={dashboard.vehicleStatus}
                search={dashboard.search}
                loading={dashboard.loading}
                onStatusChange={dashboard.setVehicleStatus}
                onSearchChange={dashboard.setSearch}
              />
            <AlertsPanel alerts={dashboard.data.alerts} drivers={dashboard.data.drivers} pendingApprovals={dashboard.data.pendingApprovals}/>
          </>}

          <footer className="manager-footer"><span>VietTour Mobility · Khu vực quản lý</span><span>Nguồn dữ liệu: MongoDB <i/> API đang hoạt động</span></footer>
        </div>
      </main>
    </div>
  );
}
