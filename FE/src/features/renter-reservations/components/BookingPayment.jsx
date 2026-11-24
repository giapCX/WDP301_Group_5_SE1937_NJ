import { useState } from 'react';
import { startCheckout } from '../api/reservationsApi.js';
import { errorMessage, money } from '../reservationFormat.js';
import PriceSummary from './PriceSummary.jsx';

const paymentLabels = { deposit: 'Đặt cọc', balance: 'Thanh toán phần còn lại', full: 'Thanh toán' };

export default function BookingPayment({ booking, checkoutAvailable, onPaid }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const { amount, purpose } = booking.paymentDue;
  const label = paymentLabels[purpose] ?? paymentLabels.full;
  const needsProvider = amount > 0;

  async function pay() {
    setPaying(true);
    setError('');
    try {
      const result = await startCheckout(booking.booking_id);
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      onPaid();
    } catch (failure) {
      setError(errorMessage(failure, 'Chưa thể mở thanh toán. Vui lòng thử lại.'));
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <h2>{label} đơn #{booking.booking_id}</h2>
      {booking.pricing_breakdown && <PriceSummary price={booking.pricing_breakdown}/>}
      <p><strong>{label} · {money(amount)}</strong></p>
      {booking.checkout_failed_at && <p className="rv-error" role="alert">Giao dịch trước không thành công. Bạn có thể thanh toán lại.</p>}
      <p>{needsProvider ? 'Chọn phương thức khả dụng trên trang thanh toán Stripe.' : 'Ưu đãi đã chi trả toàn bộ đơn.'}</p>
      {needsProvider && !checkoutAvailable && <p className="rv-notice">Thanh toán trực tuyến chưa được cấu hình.</p>}
      {error && <p className="rv-error" role="alert">{error}</p>}
      <button className="rv-button rv-primary" type="button" onClick={pay} disabled={paying || (needsProvider && !checkoutAvailable)}>
        {paying ? 'Đang xử lý…' : needsProvider ? label + ' qua Stripe' : 'Xác nhận đơn'}
      </button>
    </>
  );
}

