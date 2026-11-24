import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import useBookings from '../hooks/useBookings';
import BookingSidebar from '../components/BookingSidebar';
import BookingStats from '../components/BookingStats';
import BookingTable from '../components/BookingTable';
import BookingReview from '../components/BookingReview';
import AvailableVehicleCards from '../components/AvailableVehicleCards';
import Icon from '../components/BookingIcon';
import { BOOKING_TABS, bookingCode } from '../bookingConstants';
import '../styles/bookings.css';

export default function BookingManagementPage({
  initialStatus = 'pending',
  screen = 'dispatch',
}) {
  const user = useOutletContext();
  const bookings = useBookings(initialStatus);
  const [query, setQuery] = useState('');
  const [seats, setSeats] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const filteredItems = useMemo(
    () =>
      bookings.items.filter((booking) => {
        const text =
          `${bookingCode(booking.booking_id)} ${booking.renter?.full_name || ''} ${booking.renter?.phone || ''}`.toLocaleLowerCase(
            'vi',
          );
        return (
          text.includes(query.trim().toLocaleLowerCase('vi')) &&
          (!seats || booking.vehicle?.seat_count === Number(seats))
        );
      }),
    [bookings.items, query, seats],
  );
  const seatOptions = useMemo(
    () => [...new Set(bookings.items.map((booking) => booking.vehicle?.seat_count).filter(Number.isFinite))].sort((a, b) => a - b),
    [bookings.items],
  );
  const today = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  function refresh() {
    bookings.refresh();
    setRevision((value) => value + 1);
  }

  function updated() {
    setNotice('Đã cập nhật booking thành công.');
    refresh();
  }

  return (
    <div className="dispatch-app">
      <BookingSidebar />
      <div className="dispatch-workspace">
        <header className="dispatch-topbar">
          <div className="dispatch-breadcrumb">
            Trang chủ <Icon name="chevron" size={11} /> Điều hành{' '}
            <Icon name="chevron" size={11} />
            <strong>
              {screen === 'management' ? 'Quản lý đặt xe' : 'Điều phối chuyến đi'}
            </strong>
          </div>
          <div className="operator-profile">
            <span className="profile-avatar">
              <Icon name="user" size={18} />
            </span>
            <span>
              <strong>{user?.full_name || 'Tài khoản điều hành'}</strong>
              <small>Trung tâm điều hành</small>
            </span>
          </div>
        </header>
        <main className="dispatch-content" id="overview">
          <section className="dispatch-page-heading">
            <div>
              <div className="heading-kicker">
                <span>TRUNG TÂM ĐIỀU HÀNH</span>
                <i />
                Dữ liệu từ hệ thống
              </div>
              <h1>
                {screen === 'management' ? 'Quản Lý Đặt Xe' : 'Bàn Điều Phối Chuyến Xe'}
              </h1>
              <p>
                {screen === 'management'
                  ? 'Tra cứu toàn bộ booking và theo dõi trạng thái xử lý.'
                  : 'Theo dõi lịch trình, xét duyệt và điều phối xe cho từng hành trình.'}
              </p>
            </div>
            <div className="heading-actions">
              <span className="today-label">
                <Icon name="calendar" size={16} />
                Hôm nay, {today}
              </span>
              <button
                className="dispatch-button primary"
                disabled={bookings.loading}
                onClick={refresh}
              >
                <Icon name="refresh" size={16} />
                Làm mới dữ liệu
              </button>
            </div>
          </section>
          <BookingStats counts={bookings.counts} />
          {notice && (
            <div className="dispatch-success" role="status">
              <Icon name="check" />
              {notice}
              <button
                className="icon-button"
                aria-label="Đóng thông báo"
                onClick={() => setNotice('')}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <section className="dispatch-filters" aria-label="Lọc booking">
            <div className="booking-tabs" role="group" aria-label="Trạng thái booking">
              {BOOKING_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={bookings.status === tab.key ? 'is-active' : ''}
                  aria-pressed={bookings.status === tab.key}
                  onClick={() => {
                    bookings.changeStatus(tab.key);
                    setQuery('');
                    setSeats('');
                  }}
                >
                  {tab.label}
                  <span>{bookings.counts[tab.key] ?? '—'}</span>
                </button>
              ))}
            </div>
            <div className="booking-filter-fields">
              <label className="booking-search">
                <Icon name="search" size={17} />
                <input
                  aria-label="Tìm mã booking hoặc khách trên trang hiện tại"
                  placeholder="Tìm mã booking, tên hoặc số điện thoại…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </label>
              <label className="seat-filter">
                <Icon name="car" size={16} />
                <select
                  aria-label="Lọc số chỗ xe trên trang hiện tại"
                  value={seats}
                  onChange={(event) => setSeats(event.target.value)}
                >
                  <option value="">Tất cả số chỗ</option>
                  {seatOptions.map((value) => (
                    <option key={value} value={value}>
                      {value} chỗ
                    </option>
                  ))}
                </select>
              </label>
              <span className="filter-scope">
                Tìm kiếm & số chỗ áp dụng trên trang hiện tại
              </span>
            </div>
          </section>
          <section className="booking-list-panel" id="booking-list">
            <div className="section-heading table-heading">
              <h2>
                <Icon name="list" size={18} />
                Danh sách chuyến đi cần điều phối
              </h2>
              <span>
                {bookings.loading
                  ? 'Đang cập nhật…'
                  : `${filteredItems.length} hiển thị / ${bookings.total} booking`}
              </span>
            </div>
            <BookingTable
              items={filteredItems}
              loading={bookings.loading}
              error={bookings.error}
              onRetry={refresh}
              onSelect={setSelectedId}
            />
            <div className="booking-pagination">
              <span>
                Trang {bookings.page} / {Math.max(1, bookings.total_pages)}
              </span>
              <div>
                <button
                  className="pagination-button"
                  disabled={
                    bookings.page <= 1 || bookings.loading || Boolean(bookings.error)
                  }
                  onClick={() => bookings.setPage(bookings.page - 1)}
                >
                  <Icon name="chevron" className="rotate-icon" size={14} />
                  Trước
                </button>
                <span className="current-page">{bookings.page}</span>
                <button
                  className="pagination-button"
                  disabled={
                    bookings.page >= bookings.total_pages ||
                    bookings.loading ||
                    Boolean(bookings.error)
                  }
                  onClick={() => bookings.setPage(bookings.page + 1)}
                >
                  Sau
                  <Icon name="chevron" size={14} />
                </button>
              </div>
            </div>
          </section>
          <AvailableVehicleCards revision={revision} onSelect={setSelectedId} />
          <footer className="dispatch-footer">
            <span>VietTour · Không gian điều hành</span>
            <span>Mỗi hành trình, một trải nghiệm tốt hơn.</span>
          </footer>
        </main>
      </div>
      {selectedId && (
        <BookingReview
          key={selectedId}
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={updated}
        />
      )}
    </div>
  );
}
