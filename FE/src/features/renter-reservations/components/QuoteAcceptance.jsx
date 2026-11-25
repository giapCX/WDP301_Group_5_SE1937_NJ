import useHomeResource from "../../home/hooks/useHomeResource";
import { loadQuoteReview } from "../api/reservationsApi";
import { money } from "../reservationFormat";
import PriceSummary from "./PriceSummary";
import PassengerContract from "./PassengerContract";
export default function QuoteAcceptance({ booking, onAccepted }) {
  const review = useHomeResource(loadQuoteReview, booking.booking_id);
  return (
    <section>
      <h2>Báo giá và hợp đồng đơn #{booking.booking_id}</h2>
      <PriceSummary price={booking.pricing_breakdown} />
      <p>Cọc: {money(booking.deposit_due)}</p>
      <p>Điền thông tin, xem toàn văn và ký xác nhận trước khi thanh toán.</p>
      {review.loading && <p>Đang tải…</p>}
      {review.error && (
        <p role="alert">Chưa tải được thông tin. Vui lòng cập nhật.</p>
      )}
      {review.data && (
        <PassengerContract
          booking={booking}
          contact={review.data.contact}
          onSigned={onAccepted}
        />
      )}
    </section>
  );
}
