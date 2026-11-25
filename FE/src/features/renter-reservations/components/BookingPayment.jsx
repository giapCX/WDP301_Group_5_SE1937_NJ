import { useState } from 'react';
import { startCheckout, simulatePayment } from '../api/reservationsApi.js';
import { errorMessage, money } from '../reservationFormat.js';
import PriceSummary from './PriceSummary.jsx';

const paymentLabels = { deposit: 'Đặt cọc', balance: 'Thanh toán phần còn lại', full: 'Thanh toán' };

export default function BookingPayment({ booking, checkoutAvailable, paymentMode, onPaid }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(null);
  const [notice, setNotice] = useState('');
  const simulated = paymentMode === 'simulation';
  const { amount, purpose } = booking.paymentDue;
  const label = paymentLabels[purpose] ?? paymentLabels.full;
  const needsProvider = amount > 0;

  async function pay() {
    setPaying(true);
    setError('');
    try {
      const result = await startCheckout(booking.booking_id);
      if (result.simulated) {
        setAttempt(result);
        setNotice('');
        return;
      }
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

  async function finish(outcome) {
    if (paying) return;
    setPaying(true);
    setError('');
    try {
      await simulatePayment(booking.booking_id, attempt.attemptId, outcome);
      setAttempt(null);
      setNotice(outcome === 'success' ? 'Thanh toán mô phỏng thành công.' :
        outcome === 'failed' ? 'Đã mô phỏng giao dịch thất bại. Bạn có thể thử lại.' : 'Đã hủy thanh toán mô phỏng. Đơn chưa bị hủy.');
      onPaid(outcome);
    } catch (failure) {
      setError(errorMessage(failure, 'Chưa thể ghi nhận kết quả mô phỏng.'));
    } finally { setPaying(false); }
  }

  return (
    <>
      <h2>{label} đơn #{booking.booking_id}</h2>
      {booking.pricing_breakdown && <PriceSummary price={booking.pricing_breakdown}/>}
      <p><strong>{label} · {money(amount)}</strong></p>
      {booking.checkout_failed_at && <p className="rv-error" role="alert">Giao dịch trước không thành công. Bạn có thể thanh toán lại.</p>}
      <p>{simulated ? 'Chế độ mô phỏng dùng để test, không thu tiền thật và không cần nhập thông tin thẻ.' : needsProvider ? 'Chọn phương thức khả dụng trên trang thanh toán Stripe.' : 'Ưu đãi đã chi trả toàn bộ đơn.'}</p>
      {notice && <p className="rv-notice" role="status">{notice}</p>}
      {needsProvider && !checkoutAvailable && <p className="rv-notice">Thanh toán trực tuyến chưa được cấu hình.</p>}
      {error && <p className="rv-error" role="alert">{error}</p>}
      <button className="rv-button rv-primary" type="button" hidden={Boolean(attempt)} onClick={pay} disabled={paying || (needsProvider && !checkoutAvailable)}>
        {paying ? 'Đang xử lý…' : simulated ? label + ' mô phỏng' : needsProvider ? label + ' qua Stripe' : 'Xác nhận đơn'}
      </button>
      {attempt && <section className="rv-notice" aria-label="Thanh toán mô phỏng">
        <h3>Thanh toán mô phỏng</h3>
        <p>{paymentLabels[attempt.purpose]}: <strong>{money(attempt.amount)}</strong></p>
        <p>Chọn kết quả để kiểm tra luồng thanh toán.</p>
        <div className="rv-actions">
          <button className="rv-button rv-primary" disabled={paying} onClick={() => finish('success')}>Mô phỏng thành công</button>
          <button className="rv-button" disabled={paying} onClick={() => finish('failed')}>Mô phỏng thất bại</button>
          <button className="rv-button" disabled={paying} onClick={() => finish('cancelled')}>Hủy thanh toán</button>
        </div>
      </section>}
    </>
  );
}

