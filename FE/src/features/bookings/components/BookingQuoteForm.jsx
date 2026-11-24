export default function BookingQuoteForm({ booking, busy, onSend }) {
  const price = booking.pricing_breakdown;

  function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    onSend({ subtotal: Number(fields.get('subtotal')), deposit: Number(fields.get('deposit')) });
  }

  return (
    <form className="review-section" onSubmit={submit}>
      <h3>{booking.booking_status === 'quoted' ? 'Cập nhật báo giá' : 'Nhập báo giá'}</h3>
      {booking.requested_promotion_code && <p>Mã ưu đãi khách yêu cầu: {booking.requested_promotion_code}</p>}
      <div className="review-route">
        <label>Giá trước ưu đãi (₫)
          <input className="form-control" name="subtotal" type="number" min="0" required
            defaultValue={price ? price.subtotal + (price.surcharge ?? 0) : undefined}/>
        </label>
        <label>Tiền đặt cọc (₫)
          <input className="form-control" name="deposit" type="number" min="0" required defaultValue={booking.deposit_due}/>
        </label>
      </div>
      <button type="submit" className="dispatch-button primary" disabled={busy}>
        {busy ? 'Đang gửi…' : 'Gửi báo giá cho khách'}
      </button>
    </form>
  );
}
