import { ContractDocument } from '../components/PassengerContract';
import RenterOperations from '../../operations/components/RenterOperations';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BookingCard, { statuses } from '../components/BookingCard.jsx';
import BookingPayment from '../components/BookingPayment.jsx';
import QuoteAcceptance from '../components/QuoteAcceptance.jsx';
import ReservationLayout from '../components/ReservationLayout.jsx';
import useRenterBookings from '../hooks/useRenterBookings.js';

export default function MyBookingsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const selectedId = Number(params.get('booking'));
  const checkoutResult = params.get('checkout');
  const bookings = useRenterBookings();
  const [paymentNotice, setPaymentNotice] = useState('');
  const visible = bookings.items.filter((item) => !status || item.booking_status === status);
  const selected = bookings.items.find((item) => item.booking_id === selectedId);

  function changeParam(name, value) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('checkout');
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    });
  }

  return (
    <ReservationLayout>
      <div className="rv-heading rv-heading-actions">
        <div><h1>Đơn đặt xe của tôi</h1><p>Theo dõi báo giá, đặt cọc và thanh toán chuyến đi.</p></div>
        <Link to="/renter/bookings/new" className="rv-button rv-primary">Đặt chuyến mới</Link>
      </div>
      {paymentNotice && <p className="rv-notice" role="status">{paymentNotice}</p>}
      {checkoutResult === 'cancelled' && <p className="rv-notice" role="status">Bạn đã rời trang thanh toán. Có thể chọn thanh toán lại.</p>}
      {selected?.booking_status === 'confirmed' && <p className="rv-success" role="status">Đơn #{selectedId} đã được xác nhận.</p>}
      {checkoutResult === 'complete' && selected?.paymentDue && <p className="rv-notice" role="status">Đang chờ xác minh giao dịch. Hãy cập nhật trạng thái sau ít phút.</p>}
      {checkoutResult === 'complete' && selected?.booking_status === 'completed' && !selected.paymentDue && <p className="rv-success" role="status">Đã thanh toán phần còn lại.</p>}
      {bookings.error && <p className="rv-error" role="alert">{bookings.error}</p>}
      <div className="rv-filters-bar">
        <div className="rv-tabs" aria-label="Lọc trạng thái" role="group">
          {[['', 'Tất cả'], ...Object.entries(statuses)].map(([key, label]) => (
            <button className="rv-button" key={label} type="button" aria-pressed={status === key}
              onClick={() => changeParam('status', key)}>{label}</button>
          ))}
        </div>
        <button className="rv-button" type="button" disabled={bookings.loading} onClick={bookings.refresh}>Cập nhật</button>
      </div>
      <div className="rv-columns">
        <section className="rv-list" aria-label="Danh sách đơn đặt xe">
          {bookings.loading && <p role="status">Đang tải đơn đặt xe…</p>}
          {visible.map((booking) => <BookingCard key={booking.booking_id} booking={booking}
            selected={booking.booking_id === selectedId} onSelect={(id) => changeParam('booking', id)}/>)}
          {!bookings.loading && !visible.length && <p className="rv-panel">Chưa có đơn ở trạng thái này.</p>}
          {bookings.nextBefore && <button className="rv-button" type="button" disabled={bookings.loading} onClick={bookings.loadMore}>Tải thêm đơn</button>}
        </section>
        <aside className="rv-panel rv-summary" aria-label="Báo giá và thanh toán">
          {selected?.booking_status === 'quoted' && <QuoteAcceptance key={selected.quote_offer.id + ':' + bookings.revision}
            booking={selected} onAccepted={() => { changeParam('status', ''); bookings.refresh(); }}/>}
          {selected?.additional_charges?.some((charge) => charge.status === 'disputed') && <p role="status" className="rv-notice">Tạm dừng thanh toán để Operator giải quyết phụ phí đang tranh chấp.</p>}
          {selected?.paymentDue && <BookingPayment key={selected.booking_id + ':' + selected.paymentDue.purpose}
            booking={selected} paymentMode={bookings.paymentMode} checkoutAvailable={bookings.checkoutAvailable} onPaid={(outcome) => {
              setPaymentNotice(outcome === 'success' ? `Đơn #${selected.booking_id}: thanh toán mô phỏng thành công, không thu tiền thật.` :
                outcome === 'failed' ? 'Đã mô phỏng thất bại. Chưa ghi nhận tiền; bạn có thể thanh toán lại.' :
                outcome === 'cancelled' ? 'Đã hủy thanh toán mô phỏng. Đơn đặt xe vẫn được giữ nguyên.' : 'Đã cập nhật thanh toán.');
              bookings.refresh();
            }}/>}
          {!selected?.paymentDue && selected?.booking_status !== 'quoted' && <>
            <h2>Báo giá và thanh toán</h2>
            {!selected && <p>Chọn một đơn để xem báo giá hoặc thanh toán.</p>}
            {selected?.booking_status === 'pending' && selected.quote_requested_at && <p role="status">Đang đợi Operator gửi báo giá.</p>}
          </>}
          {selected?.transport_contract?.document && <section><h3>Hợp đồng {selected.transport_contract.status === 'active' ? 'đã kích hoạt' : selected.transport_contract.status === 'cancelled' ? 'đã hủy' : 'đã ký, chờ thanh toán'}</h3><details><summary>Xem bản đã ký</summary><ContractDocument document={selected.transport_contract.document} signature={selected.transport_contract}/></details></section>}
          {selected && <RenterOperations key={selected.booking_id} booking={selected} onUpdated={bookings.refresh}/>}
        </aside>
      </div>
    </ReservationLayout>
  );
}

