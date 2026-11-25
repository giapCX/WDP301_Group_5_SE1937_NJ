import { VehicleIllustration } from './AvailableVehicleCards';
import { dateTime } from '../bookingConstants';
export default function BookingAvailableVehicles({ booking, review }) {
  return <section className="review-section"><div className="section-heading"><h3>Xe khả dụng trong thời gian yêu cầu</h3><button type="button" className="text-button" disabled={review.loading || review.saving} onClick={review.reload}>Làm mới</button></div>
    <p>{dateTime(booking.pickup_time)} → {dateTime(booking.estimated_end_time)}</p>
    <p className="review-hint">{booking.requested_seats ? `Xe từ ${booking.requested_seats} chỗ` : `Xe ${booking.requested_seat_count || 'đúng số'} chỗ`}. Danh sách tham khảo, chưa giữ xe. Lịch được kiểm tra lại khi xác nhận.</p>
    {review.loading ? <p role="status">Đang kiểm tra lịch xe…</p> : review.vehiclesError ? <p className="dispatch-alert" role="alert">{review.vehiclesError}</p> : !review.vehicles.length ? <p className="unassigned">Không có xe phù hợp trong thời gian yêu cầu.</p> : <><p>Có {review.vehicles.length} xe phù hợp</p><div className="vehicle-cards booking-available-cards">{review.vehicles.map((vehicle) => <article className="vehicle-card" key={vehicle.vehicle_id}><div className="vehicle-art"><VehicleIllustration vehicle={vehicle}/></div><div className="vehicle-card-info"><strong>{vehicle.brand} {vehicle.model}</strong><span>{vehicle.plate_number} · {vehicle.seat_count} chỗ</span><span>Không trùng lịch trong khoảng yêu cầu</span></div></article>)}</div></>}
  </section>;
}
