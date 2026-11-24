import { useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import AlertsPanel from '../components/AlertsPanel';
import FleetStatusPanel from '../components/FleetStatusPanel';
import FleetTable from '../components/FleetTable';
import ManagerIcon from '../components/ManagerIcon';
import ManagerSidebar from '../components/ManagerSidebar';
import ManagerTopbar from '../components/ManagerTopbar';
import MetricCard from '../components/MetricCard';
import RevenueChart from '../components/RevenueChart';
import useManagerDashboard from '../hooks/useManagerDashboard';
import { ApprovalWorkspace, DriverWorkspace, FleetWorkspace, RevenueWorkspace } from './ManagerWorkspaces';
import { exportManagerReport } from '../utils/exportManagerReport';
import { formatCurrency, formatPercent, monthLabel } from '../utils/managerDashboardFormatters';
import ResourceWorkspace from '../../management/components/ResourceWorkspace.jsx';
import '../styles/managerDashboard.css';

export default function ManagerDashboardPage() {
  const user = useOutletContext();
  const [notice, setNotice] = useState('');
  const location = useLocation();
  const requestedView = location.pathname.split('/').filter(Boolean).at(-1) || 'dashboard';
  const view = ['dashboard', 'fleet', 'drivers', 'approvals', 'revenue', 'pricing', 'policies', 'promotions', 'audit'].includes(requestedView)
    ? requestedView
    : 'dashboard';
  const dashboard = useManagerDashboard(!['pricing', 'policies', 'promotions', 'audit'].includes(view));
  const metrics = dashboard.data?.metrics;
  const periodLabel = monthLabel(dashboard.year, dashboard.month);
  const page = {
    dashboard: {
      eyebrow: 'TRUNG TÂM ĐIỀU HÀNH VẬN TẢI',
      title: 'Tổng quan vận hành & Báo cáo đội xe',
      description: 'Theo dõi tình trạng đội xe, booking, doanh thu và các công việc vận hành.',
    },
    fleet: {
      eyebrow: 'QUẢN LÝ PHƯƠNG TIỆN',
      title: 'Quản lý đội xe',
      description: 'Tình trạng khai thác, lịch booking và phương tiện trong hệ thống.',
    },
    drivers: {
      eyebrow: 'HIỆU SUẤT TÀI XẾ',
      title: 'Đánh giá & Quản lý hiệu suất tài xế',
      description: 'Theo dõi trạng thái nhận chuyến, lịch sử hoàn thành, đánh giá và giấy phép.',
    },
    approvals: {
      eyebrow: 'PHÊ DUYỆT & ĐỊNH MỨC',
      title: 'Trung tâm phê duyệt & Quản lý định mức vận hành',
      description: 'Theo dõi booking chờ xử lý, hồ sơ xe và năng lực khai thác hiện tại.',
    },
    revenue: {
      eyebrow: 'DOANH THU & TÀI CHÍNH',
      title: 'Phân tích doanh thu & Tài chính vận hành',
      description: 'Đối chiếu khoản thu đã thanh toán, booking và hoàn tiền trong hệ thống.',
    },
    pricing: {
      eyebrow: 'CẤU HÌNH GIÁ DỊCH VỤ', title: 'Bảng giá dịch vụ',
      description: 'Thiết lập giá tuyến, đơn vị thời gian, giới hạn quãng đường và phụ phí.',
    },
    policies: {
      eyebrow: 'CHÍNH SÁCH DỊCH VỤ', title: 'Chính sách hủy & phụ phí',
      description: 'Quản lý điều kiện hủy, hoàn tiền, phí chờ, vượt giờ và vượt km.',
    },
    promotions: { eyebrow: 'ƯU ĐÃI & KHUYẾN MÃI', title: 'Quản lý chương trình khuyến mãi', description: 'Tạo và theo dõi các ưu đãi đang áp dụng cho dịch vụ.' },
    audit: { eyebrow: 'KIỂM SOÁT VẬN HÀNH', title: 'Nhật ký hoạt động', description: 'Theo dõi thay đổi dữ liệu xe, tài xế, bảng giá và chính sách.' },
  }[view] || {
    eyebrow: 'TRUNG TÂM ĐIỀU HÀNH VẬN TẢI',
    title: 'Tổng quan vận hành & Báo cáo đội xe',
    description: 'Theo dõi tình trạng đội xe, booking, doanh thu và các công việc vận hành.',
  };

  return (
    <div className="manager-app">
      <ManagerSidebar />
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
              <div className="manager-eyebrow"><span/> {page.eyebrow}</div>
              <h1>{page.title}</h1>
              <p>{page.description}</p>
            </div>
            <div className="manager-heading-actions">
              <span className="manager-period-chip"><ManagerIcon name="clock" size={14}/>{periodLabel}</span>
              <button className="manager-button manager-button-outline" type="button" disabled={!dashboard.data?.vehicles?.length} onClick={() => exportManagerReport(dashboard.data.vehicles, dashboard.data.period)}><ManagerIcon name="download" size={15}/> Xuất CSV</button>
              <button className="manager-button manager-button-primary" type="button" onClick={dashboard.refresh}><ManagerIcon name="refresh" size={15}/> Làm mới dữ liệu</button>
            </div>
          </section>

          {dashboard.error && <div className="manager-feedback error" role="alert">{dashboard.error}<button type="button" onClick={dashboard.refresh}>Thử lại</button></div>}
          {notice && <div className="manager-feedback" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Đóng</button></div>}
          {dashboard.loading && !dashboard.data && <div className="manager-loading" role="status"><span/>Đang tải số liệu vận hành…</div>}
          {!['pricing', 'policies', 'promotions', 'audit'].includes(view) && !dashboard.error && !dashboard.loading && !dashboard.data && <div className="manager-feedback" role="status">Chưa có dữ liệu để hiển thị.</div>}

          {['pricing', 'policies', 'promotions', 'audit'].includes(view) && <ResourceWorkspace workspace={view} actor="manager" onNotice={setNotice}/>}
          {dashboard.data && (view === 'dashboard' ? <>
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
          </> : view === 'fleet' ? <><FleetWorkspace dashboard={dashboard} /><ResourceWorkspace workspace="vehicles" actor="manager" onNotice={setNotice}/></>
              : view === 'drivers' ? <><DriverWorkspace data={dashboard.data} /><ResourceWorkspace workspace="drivers" actor="manager" onNotice={setNotice}/></>
              : view === 'approvals' ? <><ApprovalWorkspace data={dashboard.data} /><div className="manager-operations-grid manager-approval-layout"><ResourceWorkspace workspace="vehicles" actor="manager" onlyPending onNotice={setNotice}/><ResourceWorkspace workspace="drivers" actor="manager" onlyPending onNotice={setNotice}/></div></>
                : <RevenueWorkspace data={dashboard.data} />)}
          {!dashboard.data && view === 'fleet' && <ResourceWorkspace workspace="vehicles" actor="manager" onNotice={setNotice}/>}
          {!dashboard.data && view === 'drivers' && <ResourceWorkspace workspace="drivers" actor="manager" onNotice={setNotice}/>}
          {!dashboard.data && view === 'approvals' && <div className="acl-approval-workspaces"><ResourceWorkspace workspace="vehicles" actor="manager" onlyPending onNotice={setNotice}/><ResourceWorkspace workspace="drivers" actor="manager" onlyPending onNotice={setNotice}/></div>}

          <footer className="manager-footer"><span>VietTour Mobility · Khu vực quản lý</span><span>Nguồn dữ liệu: MongoDB <i/> API đang hoạt động</span></footer>
        </div>
      </main>
    </div>
  );
}
