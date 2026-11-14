import { useState } from 'react';
import Pagination from '../../../components/ui/Pagination';
import VehicleCard from '../../listings/components/VehicleCard';
import useListings from '../../listings/hooks/useListings';

const pageSize = 9;

export default function RenterVehicleSearch() {
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState(null);
  const [page, setPage] = useState(1);
  const [validation, setValidation] = useState('');
  const { listings, total, loading, error, setRetry } = useListings({ filters, sort: 'newest', search, limit: pageSize, page });

  function submit(event) {
    event.preventDefault();
    const { q, city, pickup, dropoff } = Object.fromEntries(new FormData(event.currentTarget));
    const start = pickup ? new Date(`${pickup}+07:00`) : null;
    const end = dropoff ? new Date(`${dropoff}+07:00`) : null;
    if ((pickup || dropoff) && (!start || !end || !(+start > Date.now()) || !(+end > +start))) {
      setValidation('Chọn giờ nhận trong tương lai và giờ trả sau giờ nhận.');
      return;
    }
    setValidation('');
    setPage(1);
    setFilters({ ...(q.trim() && { q: q.trim() }), ...(city.trim() && { city: city.trim() }) });
    setSearch(start ? { startAt: start.toISOString(), endAt: end.toISOString() } : null);
  }

  function openDetails(item) {
    const params = new URLSearchParams({ from: 'renter' });
    if (search) {
      params.set('start', search.startAt);
      params.set('end', search.endAt);
    }
    window.location.hash = `#/xe/${item._id}?${params}`;
  }

  return <section className="renter-card renter-vehicle-search" aria-labelledby="renter-search-title">
    <h2 id="renter-search-title">Tìm xe để thuê</h2>
    <form className="renter-grid" onSubmit={submit}>
      <label className="renter-field">Tên hoặc hãng xe<input name="q" maxLength={100} placeholder="Ví dụ Toyota Vios" /></label>
      <label className="renter-field">Thành phố nhận xe<input name="city" maxLength={100} placeholder="Ví dụ Hà Nội" /></label>
      <label className="renter-field">Giờ nhận (giờ Việt Nam)<input type="datetime-local" name="pickup" /></label>
      <label className="renter-field">Giờ trả (giờ Việt Nam)<input type="datetime-local" name="dropoff" /></label>
      <button type="submit">Tìm xe</button>
    </form>
    {validation && <p role="alert">{validation}</p>}
    {loading ? <p role="status">Đang tải danh sách xe…</p> : error ? <p role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></p>
      : listings.length ? <>
        <p>{total} xe phù hợp</p>
        <div className="vehicle-grid">{listings.map((item, index) => <VehicleCard key={item._id} listing={item} index={index} onDetails={openDetails} />)}</div>
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="Phân trang xe cho thuê" />
      </> : <p>Không tìm thấy xe phù hợp. Bạn có thể đổi địa điểm hoặc thời gian thuê.</p>}
  </section>;
}
