import { useState, useEffect } from 'react';
import { getListing } from '../../listings/api/listingApi';
import { getRenter, postRenter, vnd } from '../api/renterApi';
import { Field } from './Controls';
import { getSessionToken } from '../../auth/session';
import '../styles/renter.css';
function localDate(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export default function BookingPanel({
  listingId,
  initialDates
}) {
  const [listing, setListing] = useState(null),
    [config, setConfig] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [agreed, setAgreed] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const [dates, setDates] = useState(() => {
    const start = new Date(Date.now() + 86400000);
    return {
      start: initialDates?.start || localDate(start),
      end: initialDates?.end || localDate(new Date(+start + 86400000))
    };
  });
  useEffect(() => {
    const c = new AbortController();
    Promise.all([getListing(listingId, {
      signal: c.signal
    }), getRenter('/config', {
      signal: c.signal
    })]).then(([l, p]) => {
      setListing(l.data);
      setConfig(p.data);
    }).catch(e => {
      if (e.name !== 'AbortError') setError(e.message);
    });
    return () => c.abort();
  }, [listingId]);
  if (!listing) return <p role={error ? 'alert' : 'status'}>{error || 'Đang tải thông tin xe...'}</p>;
  const days = Math.max(0, Math.ceil((new Date(dates.end) - new Date(dates.start)) / 86400000));
  return <div className="renter-booking">{error && <p role="alert" className="renter-error">{error}</p>}<p>{listing.description}</p><div className="renter-gallery">{(listing.photos || []).filter(src => /^https?:\/\//.test(src) || src.startsWith('/uploads/') || src.startsWith('/api/listings/')).map((src, i) => <img src={src} alt={`${listing.title} · ảnh ${i + 1}`} key={src} />)}</div><p>{listing.vehicle?.brand} {listing.vehicle?.model} · {listing.vehicle?.seats} chỗ · {listing.vehicle?.transmission === 'automatic' ? 'Số tự động' : 'Số sàn'}</p><p>{listing.pickup_location?.branch_name} · {listing.pickup_location?.address_label}</p><p>Giá: {vnd(listing.daily_price)}/ngày · Cọc: {vnd(listing.security_deposit_amount)}</p><p>Quãng đường: {listing.mileage_policy?.included_km_per_day ?? 'Chưa cấu hình'} km/ngày · Phụ trội: {vnd(listing.mileage_policy?.extra_km_fee)}/km.</p><p>Hủy miễn phí trước {config?.policies.cancellation?.config.free_cancel_before_hours ?? 'chưa quy định'} giờ. Hoàn cọc trong {config?.policies.deposit_refund?.config.refund_within_business_days ?? 'thời hạn đối soát'} ngày làm việc sau khi đủ điều kiện.</p><h3>Đánh giá khách hàng</h3>{listing.reviews?.length ? listing.reviews.map(review => <p key={review._id}>{review.rating}/5 · {review.comment}</p>) : <p>Chưa có đánh giá được công khai cho xe này.</p>}
    <form onSubmit={async e => {
      e.preventDefault();
      if (busy) return;
      if (!getSessionToken()) {
        window.location.hash = '#/login';
        return;
      }
      setBusy(true);
      setError('');
      try {
        const result = await postRenter('/bookings', {
          listing_id: listing._id,
          start_at: new Date(dates.start).toISOString(),
          end_at: new Date(dates.end).toISOString(),
          agreed,
          request_key: key
        });
        window.location.hash = '#/renter/bookings/' + result.data.booking._id;
      } catch (reason) {
        setError(reason.message);
      } finally {
        setBusy(false);
      }
    }}>
      <div className="renter-grid"><Field label="Nhận xe" type="datetime-local" required value={dates.start} onChange={e => setDates({
          ...dates,
          start: e.target.value
        })} /><Field label="Trả xe" type="datetime-local" required value={dates.end} onChange={e => setDates({
          ...dates,
          end: e.target.value
        })} /></div><p>Nhận tại gara · tối thiểu 24 giờ thuê. Chưa áp dụng giao tận nơi và gói bảo hiểm trả thêm.</p><p className="renter-price">Ước tính {days} ngày: {vnd(Number.isFinite(days) ? days * listing.daily_price : 0)} + cọc {vnd(listing.security_deposit_amount)}</p><p>Giá cuối cùng và lịch xe được kiểm tra lại khi đặt. Cần xác minh giấy tờ và bổ sung địa chỉ tại <a href="#/renter/profile">hồ sơ cá nhân</a>.</p><label className="renter-check"><input type="checkbox" required checked={agreed} onChange={e => setAgreed(e.target.checked)} />Tôi đồng ý điều kiện thuê, tiền cọc và chính sách hủy.</label><button className="primary" disabled={busy || !agreed}>{busy ? 'Đang kiểm tra lịch...' : getSessionToken() ? 'Gửi yêu cầu thuê xe' : 'Đăng nhập để đặt xe'}</button>
    </form>
  </div>;
}
