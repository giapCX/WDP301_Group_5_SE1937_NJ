import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import useDriverDashboard from '../hooks/useDriverDashboard';
import DriverSidebar from '../components/DriverSidebar';
import DriverStats from '../components/DriverStats';
import DriverTripTable from '../components/DriverTripTable';
import DriverTripDetail from '../components/DriverTripDetail';
import BookingStatus from '../../bookings/components/BookingStatus';
import Icon from '../../bookings/components/BookingIcon';
import { bookingCode, dateTime } from '../../bookings/bookingConstants';
import '../../bookings/styles/bookings.css';
import '../styles/driver.css';

export default function DriverDashboardPage() {
  const user = useOutletContext();
  const dashboard = useDriverDashboard();
  const [selected, setSelected] = useState(null);
  const { data, loading, error } = dashboard;
  const current = data?.currentTrip?.booking;
  const tabs = [
    ['all', 'Tất cả'],
    ['upcoming', 'Sắp khởi hành'],
    ['active', 'Đang thực hiện'],
    ['completed', 'Hoàn thành'],
  ];
  const availability = {
    available: 'Sẵn sàng',
    busy: 'Đang bận',
    unavailable: 'Chưa sẵn sàng',
  };
  const expired =
    data?.profile.license_expiry &&
    new Date(data.profile.license_expiry).getTime() < Date.now();
  return (
    <div className="dispatch-app">
      <DriverSidebar />
      <div className="dispatch-workspace">
        <header className="dispatch-topbar">
          <div className="dispatch-breadcrumb">
            Trang chủ
            <Icon name="chevron" size={11} />
            Tài xế
            <Icon name="chevron" size={11} />
            <strong>Tổng quan</strong>
          </div>
          <div className="operator-profile">
            <span className="profile-avatar">
              <Icon name="user" size={18} />
            </span>
            <span>
              <strong>{user?.full_name || 'Tài xế'}</strong>
              <small>Tài xế VietTour</small>
            </span>
          </div>
        </header>
        <main className="dispatch-content">
          <section className="dispatch-page-heading">
            <div>
              <div className="heading-kicker">
                <span>KHÔNG GIAN TÀI XẾ</span>
                <i />
                Lịch trình của bạn
              </div>
              <h1>Xin chào, {user?.full_name || 'bạn'}!</h1>
              <p>
                Sẵn sàng cho hành trình mới. Xem lịch và chuyến được phân công ngay tại
                đây.
              </p>
            </div>
            <button
              className="dispatch-button primary"
              onClick={dashboard.refresh}
              disabled={loading}
            >
              <Icon name="refresh" size={16} />
              Làm mới dữ liệu
            </button>
          </section>
          <DriverStats stats={data?.stats} />
          {error && (
            <div className="dispatch-alert" role="alert">
              {error}
              <button onClick={dashboard.refresh}>Thử lại</button>
            </div>
          )}
          <div className="driver-overview-grid">
            <section className="driver-current">
              <div className="driver-current-kicker">
                <span>
                  <i />
                  CHUYẾN ƯU TIÊN
                </span>
                <Icon name="route" size={22} />
              </div>
              {loading ? (
                <p role="status">Đang cập nhật lịch trình…</p>
              ) : error ? (
                <p>Chưa tải được chuyến ưu tiên.</p>
              ) : current ? (
                <>
                  <div className="driver-current-heading">
                    <h2>{bookingCode(current.booking_id)}</h2>
                    <BookingStatus status={current.booking_status} />
                  </div>
                  <div className="driver-current-route">
                    <div>
                      <span>ĐIỂM ĐÓN</span>
                      <strong>{current.pickup_location}</strong>
                      <small>{dateTime(current.pickup_time)}</small>
                    </div>
                    <Icon name="arrow" size={22} />
                    <div>
                      <span>ĐIỂM TRẢ</span>
                      <strong>{current.dropoff_location}</strong>
                      <small>{dateTime(current.estimated_end_time)}</small>
                    </div>
                  </div>
                  <div className="driver-current-footer">
                    <span>
                      <Icon name="car" size={17} />
                      {current.vehicle
                        ? `${current.vehicle.brand} ${current.vehicle.model} · ${current.vehicle.plate_number}`
                        : 'Chưa có xe được giao'}
                    </span>
                    <button
                      className="dispatch-button driver-white-button"
                      onClick={() => setSelected(current.booking_id)}
                    >
                      Xem hành trình
                      <Icon name="arrow" size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="driver-no-current">
                  <Icon name="calendar" size={32} />
                  <h2>Chưa có chuyến sắp tới</h2>
                  <p>Lịch mới sẽ xuất hiện khi điều hành phân công cho bạn.</p>
                </div>
              )}
            </section>
            <section className="driver-profile-card" id="driver-profile">
              <h2>
                <Icon name="user" size={17} />
                Hồ sơ tài xế
              </h2>
              <div className="driver-profile-person">
                <span>
                  <Icon name="user" size={25} />
                </span>
                <div>
                  <strong>{user?.full_name || 'Tài xế'}</strong>
                  <small>Mã tài xế #{data?.profile.driver_id ?? '—'}</small>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>
                    {data
                      ? availability[data.profile.availability_status] ||
                        data.profile.availability_status
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Giấy phép đến</dt>
                  <dd className={expired ? 'driver-expired' : ''}>
                    {data?.profile.license_expiry
                      ? new Intl.DateTimeFormat('vi-VN').format(
                          new Date(data.profile.license_expiry),
                        )
                      : 'Chưa có thông tin'}
                  </dd>
                </div>
                <div>
                  <dt>Phê duyệt hồ sơ</dt>
                  <dd>{data?.profile.approved_at ? 'Đã ghi nhận' : 'Chưa ghi nhận'}</dd>
                </div>
              </dl>
              {expired && (
                <p className="driver-expired">
                  Giấy phép đã hết hạn. Liên hệ điều hành để cập nhật.
                </p>
              )}
            </section>
          </div>
          <section className="dispatch-filters">
            <div className="booking-tabs" role="group" aria-label="Lọc chuyến tài xế">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={dashboard.status === key}
                  className={dashboard.status === key ? 'is-active' : ''}
                  onClick={() => dashboard.filter(key)}
                >
                  {label}
                  <span>{data?.stats[key === 'all' ? 'total' : key] ?? '—'}</span>
                </button>
              ))}
            </div>
            <p className="driver-filter-note">
              <Icon name="help" size={13} />
              Chỉ hiển thị các chuyến được phân công cho tài khoản của bạn.
            </p>
          </section>
          <section className="booking-list-panel" id="driver-trips">
            <div className="section-heading table-heading">
              <h2>
                <Icon name="list" />
                Chuyến được phân công
              </h2>
              <span>
                {!loading && !error
                  ? `${data?.trips.total ?? 0} chuyến · 10 chuyến / trang`
                  : 'Đang cập nhật'}
              </span>
            </div>
            {loading ? (
              <div className="dispatch-empty" role="status">
                Đang tải danh sách chuyến…
              </div>
            ) : error ? (
              <div className="dispatch-empty">
                <p>{error}</p>
                <button className="dispatch-button subtle" onClick={dashboard.refresh}>
                  Tải lại
                </button>
              </div>
            ) : (
              <DriverTripTable rows={data?.trips.items || []} onSelect={setSelected} />
            )}
            <div className="booking-pagination">
              <span>
                Trang {dashboard.page} / {Math.max(1, data?.trips.total_pages || 0)}
              </span>
              <div>
                <button
                  className="pagination-button"
                  disabled={loading || Boolean(error) || dashboard.page <= 1}
                  onClick={() => dashboard.setPage(dashboard.page - 1)}
                >
                  <Icon name="chevron" className="rotate-icon" size={13} />
                  Trước
                </button>
                <span className="current-page">{dashboard.page}</span>
                <button
                  className="pagination-button"
                  disabled={
                    loading ||
                    Boolean(error) ||
                    dashboard.page >= (data?.trips.total_pages || 0)
                  }
                  onClick={() => dashboard.setPage(dashboard.page + 1)}
                >
                  Sau
                  <Icon name="chevron" size={13} />
                </button>
              </div>
            </div>
          </section>
          <footer className="dispatch-footer">
            <span>VietTour · Đồng hành cùng tài xế</span>
            <span>An toàn là khởi đầu của mọi hành trình.</span>
          </footer>
        </main>
      </div>
      {selected && (
        <DriverTripDetail
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
