import { useMemo, useState } from 'react';
import useListings from '../../listings/hooks/useListings';
import VehicleCard from '../../listings/components/VehicleCard';
import Modal from '../../../components/Modal';
import BookingPanel from '../components/BookingPanel';
import { statusName, dateTime } from '../api/renterApi';
import { Field } from '../components/Controls';
import useRenterSummary from '../hooks/useRenterSummary';

function initialDates() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const local = value => new Date(+value - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return { start: local(start), end: local(new Date(+start + 2 * 86400000)) };
}

export default function RenterHome({ overview = true }) {
  const { summary, error: summaryError } = useRenterSummary(overview);
  const [draft, setDraft] = useState(() => ({ ...initialDates(), city: '', brand: '', seats: '', transmission: '', fuelType: '', minPrice: '', maxPrice: '' }));
  const [criteria, setCriteria] = useState({});
  const [search, setSearch] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(6);
  const [selected, setSelected] = useState(null);
  const filters = useMemo(() => criteria, [criteria]);
  const { listings, total, loading, error, setRetry } = useListings({ filters, sort, search, limit });

  const change = event => setDraft(previous => ({ ...previous, [event.target.name]: event.target.value }));
  function submit(event) {
    event.preventDefault();
    const start = new Date(draft.start), end = new Date(draft.end);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || +start < Date.now() + 2 * 3600000 || +end - +start < 3600000) {
      setSearchError('Chọn giờ nhận xe trước ít nhất 2 giờ và giờ trả sau giờ nhận ít nhất 1 giờ.');
      return;
    }
    setSearchError('');
    setCriteria(Object.fromEntries(['brand', 'seats', 'transmission', 'fuelType', 'minPrice', 'maxPrice'].filter(key => draft[key] !== '').map(key => [key, draft[key]])));
    setSearch({ city: draft.city.trim(), startAt: start.toISOString(), endAt: end.toISOString() });
    setLimit(6);
  }

  return <div className="renter-stack">
    {overview && <>
      <section className="renter-welcome">
        <span>HÀNH TRÌNH CỦA BẠN BẮT ĐẦU TẠI ĐÂY</span>
        <h2>{summary ? `Chào ${summary.profile.full_name}!` : 'Chào mừng bạn đến với XeDi'}</h2>
        <p>Tìm xe phù hợp, quản lý chuyến đi và theo dõi mọi thông tin thuê xe trong không gian của bạn.</p>
      </section>
      {summaryError && <p role="alert" className="renter-error">{summaryError}</p>}
      <div className="renter-shortcuts">
        <a className="renter-card" href="#/renter/bookings"><span>CHUYẾN ĐI CỦA TÔI</span><strong>{summary ? summary.active.pagination.total : '—'}</strong><p>Chuyến đã xác nhận hoặc đang thuê</p><b>Xem chuyến đi →</b></a>
        <a className="renter-card" href="#/renter/bookings"><span>HỢP ĐỒNG & THANH TOÁN</span><strong>{summary ? summary.pending.pagination.total : '—'}</strong><p>Đơn đang chờ ký hoặc thanh toán</p><b>Tiếp tục đặt xe →</b></a>
        <a className="renter-card" href="#/renter/profile"><span>HỒ SƠ & XÁC MINH</span><strong className="renter-shortcut-label">{summary ? statusName(summary.profile.identity_kyc?.status) : 'Hồ sơ cá nhân'}</strong><p>Cập nhật thông tin, CCCD và giấy phép lái xe</p><b>Quản lý hồ sơ →</b></a>
        <a className="renter-card" href="#/renter/incidents"><span>HỖ TRỢ CHUYẾN ĐI</span><strong className="renter-shortcut-label">Sự cố & hỗ trợ</strong><p>Báo cáo từ chuyến đang thuê và theo dõi xử lý</p><b>Xem báo cáo sự cố →</b></a>
      </div>
      {summary?.active.data.length > 0 && <section className="renter-card"><h2>Chuyến đi sắp tới và đang thuê</h2><div className="renter-stack">{summary.active.data.slice(0, 3).map(booking => <a className="renter-upcoming" key={booking._id} href={`#/renter/bookings/${booking._id}`}><div><strong>{booking.vehicle?.brand} {booking.vehicle?.model}</strong><p>{dateTime(booking.start_at)} → {dateTime(booking.end_at)}</p></div><span>{statusName(booking.status)} →</span></a>)}</div></section>}
    </>}
    <section className="renter-card">
      <h2>{overview ? 'Tìm xe cho chuyến đi tiếp theo' : 'Tìm và đặt xe'}</h2>
      <form onSubmit={submit}>
        <div className="renter-grid renter-search-fields">
          <Field label="Địa điểm nhận xe" name="city" placeholder="Ví dụ: Hà Nội" value={draft.city} onChange={change} />
          <Field label="Ngày giờ nhận xe" name="start" type="datetime-local" required value={draft.start} onChange={change} />
          <Field label="Ngày giờ trả xe" name="end" type="datetime-local" required value={draft.end} onChange={change} />
          <Field label="Hãng xe" name="brand" placeholder="Ví dụ: Toyota" value={draft.brand} onChange={change} />
          <Field label="Giá tối thiểu / ngày" name="minPrice" type="number" min="0" value={draft.minPrice} onChange={change} />
          <Field label="Giá tối đa / ngày" name="maxPrice" type="number" min="0" value={draft.maxPrice} onChange={change} />
          {[['seats', 'Số chỗ', [['4', '4 chỗ'], ['5', '5 chỗ'], ['7', '7 chỗ']]], ['transmission', 'Hộp số', [['automatic', 'Tự động'], ['manual', 'Số sàn']]], ['fuelType', 'Nhiên liệu', [['gasoline', 'Xăng'], ['diesel', 'Dầu'], ['electric', 'Điện']]]].map(([name, label, options]) => <Field key={name} label={label}><select name={name} value={draft[name]} onChange={change}><option value="">Tất cả</option>{options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></Field>)}
        </div>
        {searchError && <p role="alert" className="renter-error">{searchError}</p>}
        <div className="renter-row"><button type="submit">Tìm xe phù hợp</button><button type="button" onClick={() => { setCriteria({}); setSearch(null); setDraft({ ...initialDates(), city: '', brand: '', seats: '', transmission: '', fuelType: '', minPrice: '', maxPrice: '' }); setSearchError(''); setLimit(6); }}>Xóa bộ lọc</button></div>
      </form>
    </section>
    <section className="renter-catalog">
      <div className="renter-row"><h2>{loading ? 'Đang tìm xe...' : `${total} xe${search ? ' phù hợp' : ' đang cho thuê'}`}</h2><Field label="Sắp xếp"><select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Mới nhất</option><option value="price_asc">Giá thấp đến cao</option><option value="price_desc">Giá cao đến thấp</option></select></Field></div>
      {loading ? <p role="status">Đang tải danh sách xe...</p> : error ? <div role="alert" className="renter-error">{error} <button onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : listings.length ? <><div className="vehicle-grid">{listings.map((listing, index) => <VehicleCard key={listing._id} listing={listing} index={index} onDetails={setSelected} />)}</div>{listings.length < total && <button className="renter-load-more" onClick={() => setLimit(value => value + 6)}>Xem thêm xe</button>}</> : <p>Chưa có xe phù hợp. Bạn thử đổi địa điểm hoặc thời gian thuê.</p>}
    </section>
    {selected && <Modal title={selected.title} onClose={() => setSelected(null)}><BookingPanel key={selected._id} listingId={selected._id} initialDates={draft} /></Modal>}
  </div>;
}
