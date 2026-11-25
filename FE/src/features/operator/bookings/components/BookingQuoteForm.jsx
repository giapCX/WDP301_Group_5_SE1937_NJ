import { useEffect, useState } from 'react';
import { fetchQuoteRates, previewBookingQuote, getBookingError, fetchContractCompany } from '../api/bookingApi';
import useHomeResource from '../../../home/hooks/useHomeResource';
import { money } from '../../../shared/booking/bookingConstants';

export default function BookingQuoteForm({ booking, busy, onSend }) {
  const [companyRevision, setCompanyRevision] = useState(0);
  const company = useHomeResource(fetchContractCompany, `${booking.booking_id}:${companyRevision}`);
  const tour = booking.service_type === 'tour';
  const saved = booking.quote_calculation?.inputs;
  const [values, setValues] = useState(saved || { outwardKm: '', returnKm: '', kmRate: '',
    dayRate: '', hourRate: '', dispatchPercent: 20, totalKm: '', nights: 0, nightRate: 300000,
    tolls: 0, parking: 0, otherFee: 0, adjustment: 0, reason: '' });
  const [hours, setHours] = useState(saved?.dailyHours?.join(', ') || '8');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [ratesReady, setRatesReady] = useState(false);
  const [deposit, setDeposit] = useState(booking.deposit_due ?? '');
  useEffect(() => {
    let active = true;
    fetchQuoteRates().then((rates) => {
      if (!active) return;
      const rate = rates[booking.requested_seats];
      if (!saved && rate) setValues((current) => ({ ...current, kmRate: rate[0], dayRate: rate[1], hourRate: rate[2] }));
      setRatesReady(true);
    }).catch((failure) => { if (active) setError(getBookingError(failure)); });
    return () => { active = false; };
  }, [booking.booking_id]);
  function change(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
    setPreview(null);
    setError('');
  }
  function numeric(key, label, step = '1') {
    return <label key={key}>{label}<input type="number" className="form-control" required
      min={key === 'adjustment' ? undefined : '0'} step={step} value={values[key]}
      onChange={(event) => change(key, event.target.value)} /></label>;
  }
  async function calculate(event) {
    event.preventDefault();
    const calculation = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, key === 'reason' ? value : Number(value)]));
    if (tour) calculation.dailyHours = hours.split(',').map((value) => value.trim() === '' ? NaN : Number(value));
    setCalculating(true);
    setError('');
    setPreview(null);
    try {
      const result = await previewBookingQuote(booking.booking_id, calculation);
      setPreview(result);
      if (deposit === '') setDeposit(Math.round(result.subtotal * 0.3));
    } catch (failure) { setError(getBookingError(failure)); }
    finally { setCalculating(false); }
  }
  return <section className="review-section">
    <h3>{booking.booking_status === 'quoted' ? 'Xem xét lại báo giá' : 'Xem xét và tính giá'}</h3>
    <p>{tour ? 'Đồng hành du lịch' : 'Đưa đi – đón về'} · Xe từ {booking.requested_seats} chỗ</p>
    <p>Đơn giá tham khảo phục vụ đồ án, cần kiểm tra trước khi gửi. Nhập quãng đường thủ công. Giá ngày gồm 8 giờ và 100 km; phí xe, tài xế, nhiên liệu đã bao gồm.</p>
    {booking.requested_promotion_code && <p>Mã ưu đãi khách yêu cầu: {booking.requested_promotion_code}. Hệ thống kiểm tra và áp dụng khi gửi báo giá.</p>}
    {error && <p className="dispatch-alert" role="alert">{error}</p>}
    <form onSubmit={calculate}>
      <fieldset disabled={busy || calculating || !ratesReady}>
        <legend>Thông số tính giá</legend>
        <div className="review-route">
          {tour ? <>
            {numeric('dayRate', 'Đơn giá/ngày (₫)')}
            {numeric('totalKm', 'Tổng quãng đường (km)', '0.1')}
            {numeric('kmRate', 'Đơn giá/km vượt (₫)')}
            {numeric('hourRate', 'Đơn giá quá giờ (₫)')}
            <label>Giờ phục vụ từng ngày (ngăn cách bằng dấu phẩy)
              <input className="form-control" required value={hours} placeholder="8, 10, 8"
                onChange={(event) => { setHours(event.target.value); setPreview(null); }}/>
              <small>Mỗi giá trị là một ngày phục vụ, không tính giờ nghỉ đêm. Ví dụ 8, 10, 8 là 3 ngày và 2 giờ vượt.</small>
            </label>
            {numeric('nights', 'Số đêm lưu trú tài xế')}
            {numeric('nightRate', 'Đơn giá lưu trú/đêm (₫)')}
          </> : <>
            {numeric('outwardKm', 'Quãng đường lượt đi (km)', '0.1')}
            {numeric('returnKm', 'Quãng đường lượt về (km)', '0.1')}
            {numeric('kmRate', 'Đơn giá/km (₫)')}
            {numeric('dispatchPercent', 'Phí điều xe (%)', '0.1')}
          </>}
          {numeric('tolls', 'Cầu đường (₫)')}
          {numeric('parking', 'Đỗ xe (₫)')}
          {numeric('otherFee', 'Phụ phí khác (₫)')}
          {numeric('adjustment', 'Điều chỉnh tăng/giảm (₫)')}
        </div>
        <label>Lý do điều chỉnh / nội dung phụ phí khác
          <textarea className="form-control" maxLength={1000} value={values.reason}
            required={Number(values.adjustment) !== 0 || Number(values.otherFee) > 0}
            onChange={(event) => change('reason', event.target.value)}/>
        </label>
        <button className="dispatch-button primary" type="submit">{calculating ? 'Đang tính…' : 'Tính giá dự kiến'}</button>
      </fieldset>
    </form>
    {preview && <div aria-live="polite">
      {preview.lines.map((line) => <div className="cost-line" key={line.label}>
        <span>{line.label} ({line.quantity} × {money(line.unit_price)})</span><strong>{money(line.amount)}</strong>
      </div>)}
      <div className="cost-line total"><span>Tổng trước ưu đãi</span><strong>{money(preview.subtotal)}</strong></div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              const contract = Object.fromEntries(
                [
                  "distanceKm",
                  "penaltyTerms",
                ].map((key) => [key, fields.get("contract_" + key)]),
              );
              onSend({
                calculation: preview.inputs,
                deposit: Number(deposit),
                contract,
              });
            }}
          >
            <fieldset disabled={busy}>
              <legend>Thông tin hợp đồng đính kèm</legend>
              <p>Thông tin bên vận tải được lấy tự động từ hồ sơ Manager.</p>
              <button type="button" disabled={busy || company.loading} onClick={() => setCompanyRevision((value) => value + 1)}>Tải lại hồ sơ Manager</button>
              {company.loading && <p role="status">Đang tải hồ sơ Manager…</p>}
              {company.error && <p role="alert">{getBookingError(company.error)}</p>}
              {company.data && <dl>
                {Object.entries({ name: 'Tên đơn vị vận tải', address: 'Địa chỉ đơn vị', taxId: 'Mã số thuế', representative: 'Người đại diện bên A', title: 'Chức vụ', phone: 'Điện thoại đơn vị' }).map(([key, label]) => (
                  <div key={key}><dt>{label}</dt><dd>{company.data[key]}</dd></div>
                ))}
              </dl>}
              <p><strong>Điều khoản có sẵn trong hợp đồng:</strong></p>
              <ul>
                <li>Tiền phí cầu đường, bãi đỗ xe: lái xe chịu trách nhiệm.</li>
                <li>Ăn nghỉ của lái xe: ăn nghỉ theo đoàn.</li>
              </ul>
              {Object.entries({
                distanceKm: "Cự ly hành trình (km)",
                penaltyTerms: "Thỏa thuận hủy / phạt vi phạm",
              }).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    className="form-control"
                    required
                    maxLength={1000}
                    name={"contract_" + key}
                    defaultValue={
                      booking.transport_contract?.company?.[key] ||
                      booking.transport_contract?.[key] ||
                      ""
                    }
                  />
                </label>
              ))}
            </fieldset>
            <label>
              Tiền đặt cọc (₫)
              <input
                className="form-control"
                type="number"
                min="0"
                step="1"
                required
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
              />
            </label>
            <p>
              Tiền cọc gợi ý ban đầu bằng 30% giá trước ưu đãi; kiểm tra lại
              theo giá sau ưu đãi khi gửi.
            </p>
            <button
              className="dispatch-button primary"
              disabled={busy || calculating || !company.data}
              type="submit"
            >
              {busy ? "Đang gửi…" : "Gửi báo giá kèm hợp đồng"}
            </button>
          </form>
    </div>}
  </section>;
}
