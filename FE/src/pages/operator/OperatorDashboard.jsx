import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import BookingSidebar from '../../features/bookings/components/BookingSidebar';
import Icon from '../../features/bookings/components/BookingIcon';
import BookingStatus from '../../features/bookings/components/BookingStatus';
import { bookingCode, dateTime, money } from '../../features/bookings/bookingConstants';
import '../../features/bookings/styles/bookings.css';
import './operator-dashboard.css';

const cards = [
  {
    key: 'totalBookings',
    label: 'Tổng số booking',
    icon: 'car',
    tone: 'blue',
    note: 'Tất cả yêu cầu đặt xe',
  },
  {
    key: 'pendingBookings',
    label: 'Chờ xét duyệt',
    icon: 'calendar',
    tone: 'red',
    note: 'Cần được xử lý',
  },
  {
    key: 'activeTrips',
    label: 'Đang di chuyển',
    icon: 'route',
    tone: 'purple',
    note: 'Hành trình đang diễn ra',
  },
  {
    key: 'completedTrips',
    label: 'Chuyến hoàn thành',
    icon: 'check',
    tone: 'teal',
    note: 'Đã kết thúc hành trình',
  },
];

export default function OperatorDashboard() {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [dashboard, bookings] = await Promise.all([
        apiClient.get('/operator/dashboard'),
        apiClient.get('/operator/bookings', { params: { page: 1, limit: 5 } }),
      ]);
      setData(dashboard.data.data);
      setRecent(bookings.data.data.items || []);
    } catch (failure) {
      setError(
        failure.response?.data?.message ||
          'Không thể kết nối API. Hãy kiểm tra máy chủ rồi thử lại.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  const today = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="dispatch-app">
      <BookingSidebar />
      <div className="dispatch-workspace">
        <header className="dispatch-topbar">
          <div className="dispatch-breadcrumb">
            Trang chủ <Icon name="chevron" size={11} /> Điều hành{' '}
            <Icon name="chevron" size={11} />
            <strong>Tổng quan điều hành</strong>
          </div>
          <div className="operator-profile">
            <span className="profile-avatar">
              <Icon name="user" size={18} />
            </span>
            <span>
              <strong>Operator Staff</strong>
              <small>Trung tâm điều hành</small>
            </span>
          </div>
        </header>
        <main className="dispatch-content">
          <section className="dispatch-page-heading">
            <div>
              <div className="heading-kicker">
                <span>TRUNG TÂM ĐIỀU HÀNH</span>
                <i /> Dữ liệu trực tiếp
              </div>
              <h1>Tổng Quan Điều Hành</h1>
              <p>Tình hình booking, chuyến đi và phương tiện trong hệ thống.</p>
            </div>
            <div className="heading-actions">
              <span className="today-label">
                <Icon name="calendar" size={16} />
                Hôm nay, {today}
              </span>
              <button
                className="dispatch-button primary"
                disabled={loading}
                onClick={load}
              >
                <Icon name="refresh" size={16} />
                Làm mới dữ liệu
              </button>
            </div>
          </section>
          {error && (
            <div className="dispatch-alert" role="alert">
              {error}
              <button className="dashboard-retry" onClick={load}>
                Thử lại
              </button>
            </div>
          )}
          <section
            className="dispatch-stats dashboard-stats"
            aria-label="Tổng quan booking"
          >
            {cards.map((card) => (
              <article className={`stat-card tone-${card.tone}`} key={card.key}>
                <div>
                  <p>{card.label}</p>
                  <strong>{loading ? '—' : (data?.[card.key] ?? 0)}</strong>
                </div>
                <span className="stat-icon">
                  <Icon name={card.icon} size={21} />
                </span>
                <span className="stat-note">
                  <i />
                  {card.note}
                </span>
              </article>
            ))}
          </section>
          <div className="dashboard-lower">
            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <h2>Booking gần đây</h2>
                  <p>Các yêu cầu đặt xe được ghi nhận gần đây.</p>
                </div>
                <Link to="/operator/booking-management">
                  Xem tất cả <Icon name="arrow" size={15} />
                </Link>
              </div>
              {loading ? (
                <div className="dashboard-empty">Đang tải dữ liệu…</div>
              ) : recent.length ? (
                <div className="dashboard-recent-list">
                  {recent.map((booking) => (
                    <Link
                      className="dashboard-recent-row"
                      to="/operator/booking-management"
                      key={booking.booking_id}
                    >
                      <span className="dashboard-booking-icon">
                        <Icon name="route" size={17} />
                      </span>
                      <span className="dashboard-recent-main">
                        <b>
                          {bookingCode(booking.booking_id)} ·{' '}
                          {booking.renter?.full_name || `Khách #${booking.renter_id}`}
                        </b>
                        <small>
                          {booking.pickup_location} → {booking.dropoff_location}
                        </small>
                      </span>
                      <span className="dashboard-recent-price">
                        {money(booking.estimated_price)}
                        <small>{dateTime(booking.created_at)}</small>
                      </span>
                      <BookingStatus status={booking.booking_status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">Chưa có booking.</div>
              )}
            </section>
            <section className="dashboard-panel dashboard-shortcuts">
              <div className="dashboard-panel-heading">
                <div>
                  <h2>Truy cập nhanh</h2>
                  <p>Đi tới khu vực điều hành.</p>
                </div>
              </div>
              <Link to="/operator/bookings">
                <span>
                  <Icon name="calendar" />
                </span>
                <b>Duyệt booking</b>
                <Icon name="arrow" size={16} />
              </Link>
              <Link to="/operator/booking-change-requests">
                <span>
                  <Icon name="route" />
                </span>
                <b>Yêu cầu đổi lịch</b>
                <Icon name="arrow" size={16} />
              </Link>
              <Link to="/operator/vehicles">
                <span>
                  <Icon name="car" />
                </span>
                <b>Xe sẵn sàng</b>
                <Icon name="arrow" size={16} />
              </Link>
            </section>
          </div>
          <footer className="dispatch-footer">
            <span>VietTour · Không gian điều hành</span>
            <span>Dữ liệu từ hệ thống</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
