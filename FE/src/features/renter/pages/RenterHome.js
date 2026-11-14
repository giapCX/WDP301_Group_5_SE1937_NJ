import { statusName, dateTime } from '../api/renterApi';
import useRenterSummary from '../hooks/useRenterSummary';
import RenterVehicleSearch from '../components/RenterVehicleSearch';

export default function RenterHome() {
  const { summary, error: summaryError } = useRenterSummary();
  return <div className="renter-stack">
    <RenterVehicleSearch />
    {summaryError && <p role="alert" className="renter-error">{summaryError}</p>}
    <div className="renter-shortcuts">
      <a className="renter-card" href="#/renter/bookings"><span>CHUYẾN ĐI CỦA TÔI</span><strong>{summary ? summary.active.pagination.total : '—'}</strong><p>Chuyến đã xác nhận hoặc đang thuê</p><b>Xem chuyến đi →</b></a>
      <a className="renter-card" href="#/renter/bookings"><span>HỢP ĐỒNG & THANH TOÁN</span><strong>{summary ? summary.pending.pagination.total : '—'}</strong><p>Đơn đang chờ ký hoặc thanh toán</p><b>Tiếp tục đặt xe →</b></a>
      <a className="renter-card" href="#/renter/profile"><strong className="renter-shortcut-label">Hồ sơ cá nhân</strong><p>Cập nhật thông tin liên hệ</p><b>Quản lý hồ sơ →</b></a>
      <a className="renter-card" href="#/renter/incidents"><span>HỖ TRỢ CHUYẾN ĐI</span><strong className="renter-shortcut-label">Sự cố & hỗ trợ</strong><p>Báo cáo từ chuyến đang thuê và theo dõi xử lý</p><b>Xem báo cáo sự cố →</b></a>
    </div>
    {summary?.active.data.length > 0 && <section className="renter-card"><h2>Chuyến đi sắp tới và đang thuê</h2><div className="renter-stack">{summary.active.data.slice(0, 3).map(booking => <a className="renter-upcoming" key={booking._id} href={`#/renter/bookings/${booking._id}`}><div><strong>{booking.vehicle?.brand} {booking.vehicle?.model}</strong><p>{dateTime(booking.start_at)} → {dateTime(booking.end_at)}</p></div><span>{statusName(booking.status)} →</span></a>)}</div></section>}
  </div>;
}
