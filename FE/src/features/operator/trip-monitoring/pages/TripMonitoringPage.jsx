import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import BookingSidebar from '../../../shared/booking/BookingSidebar';
import Icon from '../../../shared/booking/BookingIcon';
import DriverTripDetail from '../../../driver/components/DriverTripDetail';
import OperatorTopbar from '../../OperatorTopbar';
import MonitoringTable from '../components/MonitoringTable';
import useTripMonitoring from '../hooks/useTripMonitoring';
import { fetchMonitoredTrip } from '../api/tripMonitoringApi';
import { dateTime } from '../../../shared/booking/bookingConstants';
import '../../../shared/booking/bookings.css';
import '../../../driver/styles/driver.css';
import '../styles/tripMonitoring.css';

export default function TripMonitoringPage() {
  const monitor = useTripMonitoring();
  const user = useOutletContext();
  const [selected, setSelected] = useState(null);
  const stats = monitor.data?.stats;
  return (
    <div className="dispatch-app">
      <BookingSidebar />
      <div className="dispatch-workspace">
        <OperatorTopbar title="Theo dõi chuyến" user={user} />
        <main className="dispatch-content">
          <section className="dispatch-page-heading">
            <div>
              <div className="heading-kicker">
                <span>GIÁM SÁT HÀNH TRÌNH</span>
                <i />
                Tiến độ chuyến đi
              </div>
              <h1>Theo Dõi Chuyến Đi</h1>
              <p>Nắm bắt hành trình, phương tiện và cập nhật trạng thái từ hệ thống.</p>
            </div>
            <button
              className="dispatch-button primary"
              disabled={monitor.loading}
              onClick={monitor.refresh}
            >
              <Icon name="refresh" size={16} />
              Làm mới dữ liệu
            </button>
          </section>
          <section className="monitor-summary" aria-label="Thống kê chuyến">
            <article>
              <span>
                <Icon name="calendar" />
                Đã xác nhận
              </span>
              <strong>{stats?.confirmed ?? '—'}</strong>
            </article>
            <article className="monitor-active">
              <span>
                <Icon name="route" />
                Đang thực hiện
              </span>
              <strong>{stats?.in_progress ?? '—'}</strong>
            </article>
            <article>
              <span>
                <Icon name="check" />
                Hoàn thành
              </span>
              <strong>{stats?.completed ?? '—'}</strong>
            </article>
          </section>
          <section className="dispatch-filters">
            <div className="booking-tabs" role="group" aria-label="Lọc chuyến theo dõi">
              {[
                ['in_progress', 'Đang thực hiện'],
                ['confirmed', 'Đã xác nhận'],
                ['completed', 'Hoàn thành'],
                ['all', 'Tất cả'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={monitor.status === key}
                  className={monitor.status === key ? 'is-active' : ''}
                  onClick={() => monitor.filter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="monitor-caption">
              <span>
                <Icon name="clock" size={13} />
                {monitor.updatedAt
                  ? `Tải lần cuối: ${dateTime(monitor.updatedAt)}`
                  : 'Đang kết nối dữ liệu'}
              </span>
              <span>Nhấn làm mới để lấy tiến độ mới nhất · 10 chuyến / trang</span>
            </div>
          </section>
          <section className="booking-list-panel">
            <div className="section-heading table-heading">
              <h2>
                <Icon name="route" />
                Trạng thái và hành trình
              </h2>
              <span>
                {monitor.loading
                  ? 'Đang cập nhật…'
                  : `${monitor.data?.total ?? 0} chuyến phù hợp`}
              </span>
            </div>
            {monitor.loading ? (
              <div className="dispatch-empty" role="status">
                Đang tải dữ liệu chuyến…
              </div>
            ) : monitor.error ? (
              <div className="dispatch-empty" role="alert">
                <p>{monitor.error}</p>
                <button className="dispatch-button subtle" onClick={monitor.refresh}>
                  Thử lại
                </button>
              </div>
            ) : (
              <MonitoringTable items={monitor.data?.items || []} onSelect={setSelected} />
            )}
            <div className="booking-pagination">
              <span>
                Trang {monitor.page} / {Math.max(1, monitor.data?.total_pages || 0)}
              </span>
              <div>
                <button
                  className="pagination-button"
                  disabled={
                    monitor.loading || Boolean(monitor.error) || monitor.page <= 1
                  }
                  onClick={() => monitor.setPage(monitor.page - 1)}
                >
                  Trước
                </button>
                <span className="current-page">{monitor.page}</span>
                <button
                  className="pagination-button"
                  disabled={
                    monitor.loading ||
                    Boolean(monitor.error) ||
                    monitor.page >= (monitor.data?.total_pages || 0)
                  }
                  onClick={() => monitor.setPage(monitor.page + 1)}
                >
                  Sau
                </button>
              </div>
            </div>
          </section>
          <p className="monitor-footnote">
            <Icon name="help" size={15} />
            Trạng thái booking và cập nhật hành trình được hiển thị riêng; cập nhật có thể
            do Driver hoặc nhân viên điều hành ghi nhận.
          </p>
        </main>
      </div>
      {selected && (
        <DriverTripDetail
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          loadTrip={fetchMonitoredTrip}
          eyebrow="THEO DÕI HÀNH TRÌNH"
        />
      )}
    </div>
  );
}
