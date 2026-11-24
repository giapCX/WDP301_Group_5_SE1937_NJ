import { useMemo, useState } from 'react';
import FleetStatusPanel from '../components/FleetStatusPanel';
import FleetTable from '../components/FleetTable';
import ManagerIcon from '../components/ManagerIcon';
import MetricCard from '../components/MetricCard';
import RevenueChart from '../components/RevenueChart';
import { formatCurrency, formatDate, formatPercent } from '../utils/managerDashboardFormatters';

function ScreenMetrics({ children }) {
  return <section className="manager-metrics manager-screen-metrics">{children}</section>;
}

function ScreenPanel({ title, description, icon, children, className = '' }) {
  return (
    <section className={`manager-panel manager-screen-panel ${className}`}>
      <div className="manager-panel-heading">
        <div className="manager-screen-panel-title">
          {icon && <span className="manager-screen-icon"><ManagerIcon name={icon} size={15} /></span>}
          <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ colSpan, children }) {
  return <tr><td colSpan={colSpan}><div className="manager-empty-state">{children}</div></td></tr>;
}

export function FleetWorkspace({ dashboard }) {
  const metrics = dashboard.data?.metrics || {};
  return (
    <>
      <ScreenMetrics>
        <MetricCard label="TỔNG PHƯƠNG TIỆN" value={`${metrics.vehicleCount || 0} xe`} detail="Tổng số xe trong hệ thống" icon="car" tone="blue" />
        <MetricCard label="SẴN SÀNG KHAI THÁC" value={`${metrics.availableCount || 0} xe`} detail={`${formatPercent(metrics.availabilityRate)} tổng đội xe`} icon="check" tone="teal" progress={metrics.availabilityRate || 0} />
        <MetricCard label="ĐANG CÓ CHUYẾN" value={`${metrics.runningCount || 0} xe`} detail={`${metrics.activeBookingCount || 0} booking đang hoạt động`} icon="car" tone="indigo" />
        <MetricCard label="TỶ LỆ KHAI THÁC" value={formatPercent(metrics.utilizationRate)} detail="Xe đang chạy trên tổng đội xe" icon="chart" tone="orange" progress={metrics.utilizationRate || 0} />
      </ScreenMetrics>
      <FleetTable
        vehicles={dashboard.data?.vehicles || []}
        statuses={dashboard.data?.fleetStatus || []}
        selectedStatus={dashboard.vehicleStatus}
        search={dashboard.search}
        loading={dashboard.loading}
        onStatusChange={dashboard.setVehicleStatus}
        onSearchChange={dashboard.setSearch}
      />
      <section className="manager-analytics-grid manager-screen-secondary">
        <FleetStatusPanel statuses={dashboard.data?.fleetStatus || []} totalVehicles={metrics.vehicleCount || 0} />
        <ScreenPanel title="Theo dõi khai thác" description="Booking và xe đang được sử dụng." icon="car">
          <div className="manager-capacity-summary">
            <div><span>Booking hoạt động</span><b>{metrics.activeBookingCount || 0}</b></div>
            <div><span>Xe đang chạy</span><b>{metrics.runningCount || 0}</b></div>
            <div><span>Xe sẵn sàng</span><b>{metrics.availableCount || 0}</b></div>
          </div>
        </ScreenPanel>
      </section>
    </>
  );
}

function licenseState(value) {
  if (!value) return { label: 'Chưa có dữ liệu', tone: 'unknown', needsAttention: true };
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return { label: 'Chưa có dữ liệu', tone: 'unknown', needsAttention: true };
  const days = Math.ceil((time - Date.now()) / 86400000);
  if (days < 0) return { label: 'Đã hết hạn', tone: 'maintenance', needsAttention: true };
  if (days <= 30) return { label: 'Sắp hết hạn', tone: 'pending', needsAttention: true };
  return { label: 'Còn hiệu lực', tone: 'ready', needsAttention: false };
}

function driverAvailability(value) {
  const status = String(value || 'unknown').toLowerCase();
  if (status === 'available') return { label: 'Sẵn sàng', tone: 'ready' };
  if (['busy', 'on_trip', 'in_use', 'ongoing'].includes(status)) return { label: 'Đang nhận chuyến', tone: 'rented' };
  if (['inactive', 'suspended', 'unavailable'].includes(status)) return { label: 'Tạm ngưng', tone: 'paused' };
  return { label: value || 'Chưa cập nhật', tone: 'unknown' };
}

export function DriverWorkspace({ data }) {
  const drivers = data?.drivers || [];
  const metrics = data?.metrics || {};
  const [query, setQuery] = useState('');
  const visibleDrivers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    if (!normalized) return drivers;
    return drivers.filter((driver) => `${driver.name || ''} ${driver.id}`.toLocaleLowerCase('vi').includes(normalized));
  }, [drivers, query]);
  const attentionCount = drivers.filter((driver) => licenseState(driver.licenseExpiry).needsAttention).length;

  return (
    <>
      <ScreenMetrics>
        <MetricCard label="TỔNG TÀI XẾ" value={`${metrics.driverCount || 0} người`} detail="Hồ sơ tài xế đã ghi nhận" icon="users" tone="blue" />
        <MetricCard label="SẴN SÀNG NHẬN CHUYẾN" value={`${metrics.availableDriverCount || 0} người`} detail={`${metrics.activeDriverCount || 0} người đang bận`} icon="check" tone="teal" />
        <MetricCard label="CHUYẾN ĐÃ HOÀN THÀNH" value={`${metrics.completedDriverTripCount || 0} chuyến`} detail={`${metrics.driverTripCount || 0} chuyến được phân công`} icon="check" tone="indigo" />
        <MetricCard label="ĐIỂM ĐÁNH GIÁ TRUNG BÌNH" value={metrics.averageDriverRating == null ? '—' : `${metrics.averageDriverRating}/5`} detail={`${drivers.reduce((sum, driver) => sum + (driver.reviewCount || 0), 0)} đánh giá có dữ liệu`} icon="chart" tone="orange" />
      </ScreenMetrics>
      <div className="manager-operations-grid manager-driver-layout">
        <ScreenPanel title="Danh sách tài xế & hiệu suất" description="Số chuyến, đánh giá và tình trạng hồ sơ theo dữ liệu hệ thống." icon="users" className="manager-driver-table-panel">
          <div className="manager-screen-toolbar">
            <label className="manager-search"><ManagerIcon name="search" size={15} /><input aria-label="Tìm tài xế" placeholder="Tìm theo tên hoặc mã tài xế" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <span>{visibleDrivers.length} tài xế</span>
          </div>
          <div className="manager-table-wrap">
            <table className="manager-fleet-table manager-driver-table">
              <thead><tr><th>TÀI XẾ</th><th>TRẠNG THÁI</th><th>CHUYẾN</th><th>ĐÁNH GIÁ</th><th>GIẤY PHÉP LÁI XE</th></tr></thead>
              <tbody>
                {visibleDrivers.map((driver) => {
                  const availability = driverAvailability(driver.availability);
                  const license = licenseState(driver.licenseExpiry);
                  return <tr key={driver.id}>
                    <td><div className="manager-driver-cell"><span className="manager-driver-avatar"><ManagerIcon name="users" size={15} /></span><span><b>{driver.name || `Tài xế #${driver.id}`}</b><small>Mã tài xế #{driver.id}</small></span></div></td>
                    <td><span className={`manager-status-pill ${availability.tone}`}><i />{availability.label}</span></td>
                    <td><b>{driver.completedTripCount || 0}/{driver.tripCount || 0}</b><small className="manager-cell-secondary">{formatPercent(driver.completionRate || 0)} hoàn thành</small></td>
                    <td><b>{driver.rating == null ? '—' : `${driver.rating}/5`}</b><small className="manager-cell-secondary">{driver.reviewCount || 0} đánh giá</small></td>
                    <td><span className={`manager-status-pill ${license.tone}`}><i />{license.label}</span><small className="manager-cell-secondary">{formatDate(driver.licenseExpiry)}</small></td>
                  </tr>;
                })}
                {!visibleDrivers.length && <EmptyRow colSpan={5}>{query ? 'Không tìm thấy tài xế phù hợp.' : 'Chưa có hồ sơ tài xế.'}</EmptyRow>}
              </tbody>
            </table>
          </div>
        </ScreenPanel>
        <div className="manager-driver-side">
          <ScreenPanel title="Tình trạng đội ngũ" description="Phân bổ theo trạng thái hiện tại." icon="users">
            <div className="manager-driver-status-list">
              {[
                ['Sẵn sàng', metrics.availableDriverCount || 0, 'ready'],
                ['Đang nhận chuyến', metrics.activeDriverCount || 0, 'rented'],
                ['Hồ sơ cần chú ý', attentionCount, 'pending'],
              ].map(([label, value, tone]) => <div key={label}><span className={`manager-status-dot ${tone}`} /><span>{label}</span><b>{value}</b></div>)}
            </div>
          </ScreenPanel>
          <ScreenPanel title="Giấy phép cần theo dõi" description="Hồ sơ hết hạn, sắp hết hạn hoặc chưa có ngày hết hạn." icon="alert">
            {attentionCount ? <ul className="manager-watch-list">{drivers.filter((driver) => licenseState(driver.licenseExpiry).needsAttention).slice(0, 5).map((driver) => <li key={driver.id}><b>{driver.name || `Tài xế #${driver.id}`}</b><span>{licenseState(driver.licenseExpiry).label} · {formatDate(driver.licenseExpiry)}</span></li>)}</ul> : <div className="manager-empty-state">Không có giấy phép cần theo dõi.</div>}
          </ScreenPanel>
        </div>
      </div>
    </>
  );
}

function approvalLabel(value) {
  const status = String(value || 'pending').toLowerCase();
  if (['pending', 'pending_review'].includes(status)) return 'Chờ phê duyệt';
  if (status === 'approved') return 'Đã phê duyệt';
  return value || 'Chờ phê duyệt';
}

export function ApprovalWorkspace({ data }) {
  const metrics = data?.metrics || {};
  const pendingBookings = data?.pendingBookings || [];
  const pendingVehicles = data?.pendingApprovals || [];
  const vehicleCount = metrics.vehicleCount || 0;
  const usedCount = metrics.runningCount || 0;
  const utilization = metrics.utilizationRate || 0;

  return (
    <>
      <ScreenMetrics>
        <MetricCard label="BOOKING CHỜ XỬ LÝ" value={`${pendingBookings.length} booking`} detail="Yêu cầu đặt xe đang chờ" icon="calendar" tone="blue" />
        <MetricCard label="HỒ SƠ XE CHỜ DUYỆT" value={`${pendingVehicles.length} xe`} detail="Hồ sơ phương tiện cần xem xét" icon="check" tone="orange" />
        <MetricCard label="BOOKING ĐANG HOẠT ĐỘNG" value={`${metrics.activeBookingCount || 0} booking`} detail="Chuyến đã được xác nhận hoặc đang chạy" icon="route" tone="indigo" />
        <MetricCard label="TỶ LỆ KHAI THÁC" value={formatPercent(utilization)} detail={`${usedCount}/${vehicleCount} xe đang chạy`} icon="chart" tone="teal" progress={utilization} />
      </ScreenMetrics>
      <div className="manager-operations-grid manager-approval-layout">
        <ScreenPanel title="Hàng đợi phê duyệt booking" description="Yêu cầu mới nhất cần được điều phối." icon="calendar">
          <div className="manager-table-wrap">
            <table className="manager-fleet-table manager-approval-table">
              <thead><tr><th>BOOKING / KHÁCH</th><th>XE YÊU CẦU</th><th>ĐIỂM ĐÓN</th><th>GIÁ DỰ KIẾN</th><th>TRẠNG THÁI</th></tr></thead>
              <tbody>
                {pendingBookings.map((booking) => <tr key={booking.id}>
                  <td><div className="manager-cell-primary"><b>BK-{String(booking.id).padStart(5, '0')}</b><small>{booking.renterName || 'Chưa có tên khách'} · {formatDate(booking.createdAt)}</small></div></td>
                  <td>{booking.vehicleName || 'Chưa gán xe'}<small className="manager-cell-secondary">{booking.requestedSeatCount ? `${booking.requestedSeatCount} chỗ` : 'Chưa có số chỗ'}</small></td>
                  <td>{formatDate(booking.pickupAt)}</td>
                  <td>{formatCurrency(booking.estimatedPrice)}</td>
                  <td><span className="manager-status-pill pending"><i />{approvalLabel(booking.status)}</span></td>
                </tr>)}
                {!pendingBookings.length && <EmptyRow colSpan={5}>Không có booking đang chờ xử lý.</EmptyRow>}
              </tbody>
            </table>
          </div>
        </ScreenPanel>
        <ScreenPanel title="Định mức & năng lực đội xe" description="Mức khai thác hiện tại so với quy mô đội xe." icon="car" className="manager-capacity-panel">
          <div className="manager-capacity-summary">
            <div><span>Tổng phương tiện</span><b>{vehicleCount}</b></div>
            <div><span>Đang khai thác</span><b>{usedCount}</b></div>
            <div><span>Sẵn sàng</span><b>{metrics.availableCount || 0}</b></div>
          </div>
          <div className="manager-capacity-meter"><div><span>Mức khai thác</span><b>{formatPercent(utilization)}</b></div><span className="manager-capacity-track"><i style={{ width: `${Math.min(100, Math.max(0, utilization))}%` }} /></span></div>
          <p className="manager-screen-note">Chỉ số được tính từ trạng thái xe và booking đang hoạt động. Định mức cấu hình chưa có trong dữ liệu hệ thống.</p>
        </ScreenPanel>
      </div>
      <ScreenPanel title="Hồ sơ xe chờ phê duyệt" description="Các phương tiện có trạng thái hồ sơ đang chờ." icon="check" className="manager-approval-vehicles">
        <div className="manager-table-wrap">
          <table className="manager-fleet-table">
            <thead><tr><th>PHƯƠNG TIỆN</th><th>BIỂN SỐ</th><th>SỐ CHỖ</th><th>GIÁ THUÊ / NGÀY</th><th>TRẠNG THÁI HỒ SƠ</th></tr></thead>
            <tbody>
              {pendingVehicles.map((vehicle) => <tr key={vehicle.vehicle_id}>
                <td><b>{[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || `Xe #${vehicle.vehicle_id}`}</b></td>
                <td>{vehicle.plate_number || '—'}</td>
                <td>{vehicle.seat_count ?? vehicle.seats ?? '—'}</td>
                <td>{vehicle.price_per_day == null && vehicle.base_price_per_day == null ? '—' : formatCurrency(vehicle.price_per_day ?? vehicle.base_price_per_day)}</td>
                <td><span className="manager-status-pill pending"><i />{approvalLabel(vehicle.approval_status || vehicle.status)}</span></td>
              </tr>)}
              {!pendingVehicles.length && <EmptyRow colSpan={5}>Không có hồ sơ xe chờ phê duyệt.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </ScreenPanel>
    </>
  );
}

export function RevenueWorkspace({ data }) {
  const metrics = data?.metrics || {};
  const trend = data?.revenueTrend || [];
  const financials = data?.financials || {};
  const averagePayment = metrics.paidPaymentCount ? metrics.revenue / metrics.paidPaymentCount : 0;

  return (
    <>
      <ScreenMetrics>
        <MetricCard label="DOANH THU ĐÃ THU" value={formatCurrency(metrics.revenue)} detail="Giao dịch đã thanh toán trong kỳ" icon="chart" tone="blue" />
        <MetricCard label="GIAO DỊCH ĐÃ THANH TOÁN" value={`${metrics.paidPaymentCount || 0}`} detail="Trong kỳ đang chọn" icon="check" tone="teal" />
        <MetricCard label="GIÁ TRỊ THANH TOÁN TRUNG BÌNH" value={formatCurrency(averagePayment)} detail="Doanh thu chia số giao dịch đã thu" icon="activity" tone="indigo" />
        <MetricCard label="HOÀN TIỀN ĐÃ XỬ LÝ" value={formatCurrency(financials.completedRefundAmount)} detail={`${financials.completedRefundCount || 0} khoản · mọi kỳ`} icon="alert" tone="orange" />
      </ScreenMetrics>
      <section className="manager-finance-chart-grid">
        <RevenueChart items={trend} year={data?.period?.year} month={data?.period?.month} />
        <ScreenPanel title="Tổng hợp dòng tiền" description="Khoản thu và hoàn tiền có trong dữ liệu." icon="chart">
          <div className="manager-finance-summary">
            <div><span>Thu đã thanh toán trong kỳ</span><b>{formatCurrency(metrics.revenue)}</b></div>
            <div><span>Số giao dịch</span><b>{metrics.paidPaymentCount || 0}</b></div>
            <div><span>Hoàn tiền đã xử lý, mọi kỳ</span><b>{formatCurrency(financials.completedRefundAmount)}</b></div>
          </div>
          <p className="manager-screen-note">Hệ thống chưa lưu chi phí vận hành theo kỳ. Màn hình không ước tính chi phí khi chưa có dữ liệu nguồn.</p>
        </ScreenPanel>
      </section>
      <ScreenPanel title="Doanh thu & booking theo tuần" description="Đối chiếu số thu đã thanh toán với số booking trong tháng." icon="calendar">
        <div className="manager-table-wrap">
          <table className="manager-fleet-table manager-finance-table">
            <thead><tr><th>GIAI ĐOẠN</th><th>BOOKING</th><th>DOANH THU</th><th>TỶ TRỌNG DOANH THU</th></tr></thead>
            <tbody>{trend.map((item) => {
              const share = metrics.revenue ? (item.revenue / metrics.revenue) * 100 : 0;
              return <tr key={item.key}><td><b>{item.label}</b></td><td>{item.bookings}</td><td>{formatCurrency(item.revenue)}</td><td><span className="manager-finance-share"><i style={{ width: `${Math.min(100, share)}%` }} /></span><small>{formatPercent(share)}</small></td></tr>;
            })}{!trend.length && <EmptyRow colSpan={4}>Chưa có dữ liệu doanh thu trong kỳ.</EmptyRow>}</tbody>
          </table>
        </div>
      </ScreenPanel>
    </>
  );
}
