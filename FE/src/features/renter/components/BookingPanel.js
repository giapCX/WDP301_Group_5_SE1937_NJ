import { listingPhotos, isListingIllustration } from '../../listings/components/VehicleCard';
import Icon from '../../../components/Icon';
import Modal from '../../../components/Modal';
import RelatedVehicles from '../../listings/components/RelatedVehicles';
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
  const [photoIndex, setPhotoIndex] = useState(null);
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
  const vehicle = listing.vehicle || {};
  const specifications = [
    ['Năm sản xuất', vehicle.manufacture_year || 'Chưa cập nhật'],
    ['Số chỗ', vehicle.seats ? vehicle.seats + ' chỗ' : 'Chưa cập nhật'],
    ['Hộp số', vehicle.transmission === 'automatic' ? 'Tự động' : vehicle.transmission === 'manual' ? 'Số sàn' : 'Chưa cập nhật'],
    ['Nhiên liệu', ({ gasoline: 'Xăng', diesel: 'Dầu diesel', electric: 'Điện', hybrid: 'Hybrid' })[vehicle.fuel_type] || 'Chưa cập nhật'],
    ['Loại xe', vehicle.vehicle_type || 'Chưa cập nhật'],

  ];
  const photos = [...new Set(listingPhotos(listing).filter(src => !isListingIllustration(src)))];
  const location = listing.pickup_location;
  const cancellationHours = config?.policies?.cancellation?.config?.free_cancel_before_hours;
  const refundDays = config?.policies?.deposit_refund?.config?.refund_within_business_days;
  const fees = [
    ['Phí vượt giới hạn', listing.mileage_policy?.extra_km_fee, '/km'],
    ['Phí trả muộn', listing.rental_policy_snapshot?.late_fee_per_hour, '/giờ'],
  ].filter(([, amount]) => amount != null);
  const rentalTotal = Number.isFinite(days) && days > 0 ? days * listing.daily_price : null;
  const sections = [['features', 'Đặc điểm'], ['documents', 'Giấy tờ thuê xe'], ['pickup', 'Vị trí xe']];

  async function submitBooking(event) {
    event.preventDefault();
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
        request_key: key,
      });
      window.location.hash = '#/renter/bookings/' + result.data.booking._id;
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="renter-booking renter-vehicle-detail">
    {photos.length > 0 ? <div className={'detail-gallery detail-gallery-' + Math.min(photos.length, 4)}>
      {photos.slice(0, 4).map((src, index) => (
        <button type="button" key={src} onClick={() => setPhotoIndex(index)} aria-label={'Mở ảnh xe ' + (index + 1)}>
          <img src={src} alt={listing.title + ' · ảnh ' + (index + 1)} />
        </button>
      ))}
      <button type="button" className="detail-all-photos" onClick={() => setPhotoIndex(0)}>
        Xem tất cả ảnh ({photos.length})
      </button>
      {photos.some(src => src.startsWith('/images/demo-vehicles/')) && (
        <span className="detail-photo-reference">Ảnh tham khảo theo mẫu xe</span>
      )}
    </div> : <div className="vehicle-photo-placeholder detail-photo-empty">
      <Icon name="car" size={40} /> Chưa có ảnh xe
    </div>}
    {photoIndex !== null && <Modal title={'Ảnh xe ' + (photoIndex + 1) + '/' + photos.length} onClose={() => setPhotoIndex(null)}>
      <img className="detail-full-photo" src={photos[photoIndex]} alt={listing.title + ' · ảnh ' + (photoIndex + 1)} />
      {photos.length > 1 && <div className="detail-photo-controls">
        <button type="button" onClick={() => setPhotoIndex((photoIndex + photos.length - 1) % photos.length)}>Ảnh trước</button>
        <button type="button" onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)}>Ảnh tiếp</button>
      </div>}
    </Modal>}
    <header className="detail-title">
      <h1>{listing.title}</h1>
      {location?.city && <p>{location.city}</p>}
    </header>
    <nav className="detail-section-nav" aria-label="Nội dung chi tiết xe">
      {sections.map(([id, label]) => <button type="button" key={id}
        onClick={() => document.getElementById('detail-' + id)?.scrollIntoView({ behavior: 'smooth' })}>{label}</button>)}
    </nav>
    <div className="detail-columns">
      <div className="detail-information">
        <section id="detail-features">
          <h2>Đặc điểm</h2>
          <dl className="renter-vehicle-specs">
            {specifications.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
        {listing.description && <section><h2>Mô tả</h2><p className="detail-description">{listing.description}</p></section>}
        <section id="detail-documents">
          <h2>Giấy tờ thuê xe</h2>
          <ul>
            <li>CCCD hoặc hộ chiếu đã xác minh.</li>
            <li>Giấy phép lái xe đã xác minh, còn hạn đến thời điểm trả xe.</li>
            <li>Địa chỉ liên hệ đã lưu trong <a href="#/renter/profile">hồ sơ cá nhân</a>.</li>
          </ul>
        </section>
        <section>
          <h2>Điều kiện thuê</h2>
          <p>Thời gian thuê tối thiểu 24 giờ. Nhận và trả xe tại gara.</p>
          {listing.mileage_policy?.included_km_per_day != null && <p>Quãng đường bao gồm {listing.mileage_policy.included_km_per_day} km/ngày.</p>}
          {cancellationHours != null && <p>Hủy miễn phí trước giờ nhận xe ít nhất {cancellationHours} giờ theo chính sách áp dụng.</p>}
          {refundDays != null && <p>Hoàn cọc trong {refundDays} ngày làm việc sau khi đủ điều kiện.</p>}
        </section>
        <section id="detail-pickup">
          <h2>Vị trí xe</h2>
          <p className="detail-location"><Icon name="pin" size={19} /> <strong>{location?.branch_name || 'Gara XeDi'}</strong></p>
          <p>{location?.address_label || location?.city || 'Địa chỉ gara đang được cập nhật.'}</p>
        </section>
      </div>
      <aside className="detail-booking-sidebar" aria-label="Đặt xe và chi phí">
        <section className="renter-booking-box">
          <h2>Chọn lịch thuê</h2>
          <p className="detail-daily-rate">{vnd(listing.daily_price)} <small>/ ngày</small></p>
          <form onSubmit={submitBooking}>
            <div className="renter-grid detail-date-grid">
              <Field label="Nhận xe" type="datetime-local" required value={dates.start}
                onChange={event => setDates({ ...dates, start: event.target.value })} />
              <Field label="Trả xe" type="datetime-local" required value={dates.end}
                onChange={event => setDates({ ...dates, end: event.target.value })} />
            </div>
            <div className="detail-garage-box">
              <strong>Nhận và trả xe tại gara</strong>
              <span>{location?.branch_name || location?.city || 'Gara XeDi'}</span>
            </div>
            <dl className="detail-costs">
              <div><dt>{rentalTotal != null ? 'Tiền thuê · ' + days + ' ngày' : 'Tiền thuê'}</dt><dd>{rentalTotal != null ? vnd(rentalTotal) : '—'}</dd></div>
              <div><dt>Tiền cọc</dt><dd>{vnd(listing.security_deposit_amount)}</dd></div>
              <div className="detail-total"><dt>Tổng dự kiến</dt><dd>{rentalTotal != null ? vnd(rentalTotal + Number(listing.security_deposit_amount || 0)) : '—'}</dd></div>
            </dl>
            <p className="renter-muted">Giá và lịch xe được xác nhận khi gửi yêu cầu.</p>
            <label className="renter-check"><input type="checkbox" required checked={agreed} onChange={event => setAgreed(event.target.checked)} />Tôi đồng ý điều kiện thuê, tiền cọc và chính sách hủy.</label>
            {error && <p role="alert" className="renter-error">{error}</p>}
            <button className="primary" disabled={busy || !agreed}>{busy ? 'Đang kiểm tra lịch...' : getSessionToken() ? 'Gửi yêu cầu thuê xe' : 'Đăng nhập để đặt xe'}</button>
          </form>
        </section>
        {fees.length > 0 && <section className="detail-fees">
          <h2>Phụ phí có thể phát sinh</h2>
          <dl className="detail-costs">{fees.map(([label, amount, unit]) => <div key={label}><dt>{label}</dt><dd>{vnd(amount)}{unit}</dd></div>)}</dl>
        </section>}
      </aside>
    </div>
    <RelatedVehicles listing={listing} />
  </div>;
}
