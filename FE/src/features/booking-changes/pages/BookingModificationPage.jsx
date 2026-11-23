import { useState } from 'react';
import BookingSidebar from '../../bookings/components/BookingSidebar';
import Icon from '../../bookings/components/BookingIcon';
import useChangeRequests from '../hooks/useChangeRequests';
import ChangeRequestTable from '../components/ChangeRequestTable';
import ChangeRequestDetail from '../components/ChangeRequestDetail';
import { CHANGE_STATUSES } from '../changeConstants';
import '../../bookings/styles/bookings.css';
import '../styles/bookingChanges.css';

export default function BookingModificationPage() {
  const requests = useChangeRequests();
  const [selectedId, setSelectedId] = useState(null);
  const [bookingInput, setBookingInput] = useState('');
  const [filterError, setFilterError] = useState('');
  const [notice, setNotice] = useState('');
  function filterBooking(event) {
    event.preventDefault();
    const value = bookingInput.trim();
    if (
      value &&
      (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)
    ) {
      setFilterError('Nhập ID booking là số nguyên dương, ví dụ: 2.');
      return;
    }
    setFilterError('');
    requests.filterBooking(value);
  }
  function updated(action) {
    setNotice(
      action === 'approve'
        ? 'Đã duyệt thay đổi và cập nhật lịch trình booking.'
        : 'Đã từ chối yêu cầu. Lịch trình booking được giữ nguyên.',
    );
    requests.refresh();
  }
  return (
    <div className="dispatch-app">
      <BookingSidebar />
      <div className="dispatch-workspace">
        <header className="dispatch-topbar">
          <div className="dispatch-breadcrumb">
            Trang chủ
            <Icon name="chevron" size={11} />
            Điều hành
            <Icon name="chevron" size={11} />
            <strong>Thay đổi lịch trình</strong>
          </div>
          <div className="operator-profile">
            <span className="profile-avatar">
              <Icon name="user" />
            </span>
            <span>
              <strong>Operator Staff</strong>
              <small>Trung tâm điều hành</small>
            </span>
          </div>
        </header>
        <main className="dispatch-content" id="overview">
          <section className="dispatch-page-heading">
            <div>
              <div className="heading-kicker">
                <span>QUẢN LÝ ĐẶT XE</span>
                <i />
                Điều chỉnh hành trình
              </div>
              <h1>Thay Đổi Lịch Trình</h1>
              <p>Xem xét từng thay đổi, giữ mọi hành trình trong tầm kiểm soát.</p>
            </div>
            <button
              className="dispatch-button primary"
              disabled={requests.loading}
              onClick={requests.refresh}
            >
              <Icon name="refresh" size={16} />
              Làm mới dữ liệu
            </button>
          </section>
          <div className="change-intro">
            <span className="change-intro-icon">
              <Icon name="route" size={25} />
            </span>
            <div>
              <strong>Một thay đổi nhỏ. Một hành trình tốt hơn.</strong>
              <p>
                So sánh lịch cũ và lịch đề xuất trước khi đưa ra quyết định. Booking chỉ
                thay đổi khi yêu cầu được duyệt.
              </p>
            </div>
            <span className="change-intro-badge">BOOKING MODIFICATION</span>
          </div>
          {notice && (
            <div className="dispatch-success" role="status">
              <Icon name="check" />
              {notice}
              <button
                className="icon-button"
                aria-label="Đóng thông báo"
                onClick={() => setNotice('')}
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          <section className="dispatch-filters" aria-label="Lọc yêu cầu đổi lịch">
            <div className="booking-tabs" role="group" aria-label="Trạng thái yêu cầu">
              {CHANGE_STATUSES.map((status) => (
                <button
                  key={status.key}
                  className={requests.status === status.key ? 'is-active' : ''}
                  aria-pressed={requests.status === status.key}
                  onClick={() => requests.filterStatus(status.key)}
                >
                  {status.label}
                </button>
              ))}
            </div>
            <form className="change-filter-form" onSubmit={filterBooking}>
              <label className="booking-search">
                <Icon name="search" size={17} />
                <input
                  aria-label="ID booking"
                  placeholder="Lọc theo ID booking, ví dụ: 2"
                  inputMode="numeric"
                  value={bookingInput}
                  onChange={(event) => setBookingInput(event.target.value)}
                />
              </label>
              <button type="submit" className="dispatch-button subtle">
                Áp dụng
              </button>
              {requests.bookingFilter && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setBookingInput('');
                    setFilterError('');
                    requests.filterBooking('');
                  }}
                >
                  Bỏ lọc
                </button>
              )}
              <span className="change-page-size">10 yêu cầu / trang</span>
            </form>
            {filterError && (
              <p className="change-filter-error" role="alert">
                {filterError}
              </p>
            )}
          </section>
          <section className="booking-list-panel" id="booking-list">
            <div className="section-heading table-heading">
              <h2>
                <Icon name="list" />
                Yêu cầu thay đổi lịch trình
              </h2>
              <span>
                {requests.loading
                  ? 'Đang cập nhật…'
                  : `${requests.total} yêu cầu phù hợp`}
              </span>
            </div>
            <ChangeRequestTable
              items={requests.items}
              loading={requests.loading}
              error={requests.error}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRetry={requests.refresh}
            />
            <div className="booking-pagination">
              <span>
                Trang {requests.page} / {Math.max(1, requests.total_pages)}
              </span>
              <div>
                <button
                  className="pagination-button"
                  disabled={
                    requests.loading || Boolean(requests.error) || requests.page <= 1
                  }
                  onClick={() => requests.setPage(requests.page - 1)}
                >
                  <Icon name="chevron" className="rotate-icon" size={14} />
                  Trước
                </button>
                <span className="current-page">{requests.page}</span>
                <button
                  className="pagination-button"
                  disabled={
                    requests.loading ||
                    Boolean(requests.error) ||
                    requests.page >= requests.total_pages
                  }
                  onClick={() => requests.setPage(requests.page + 1)}
                >
                  Sau
                  <Icon name="chevron" size={14} />
                </button>
              </div>
            </div>
          </section>
          {selectedId ? (
            <ChangeRequestDetail
              key={selectedId}
              id={selectedId}
              revision={requests.revision}
              onUpdated={updated}
            />
          ) : (
            <div className="change-selection-hint">
              <Icon name="list" />
              Chọn một yêu cầu để so sánh lịch trình trước và sau thay đổi.
            </div>
          )}
          <footer className="dispatch-footer">
            <span>VietTour · Không gian điều hành</span>
            <span>Mỗi hành trình, một trải nghiệm tốt hơn.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
