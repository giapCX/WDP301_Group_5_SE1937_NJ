import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useHomeResource from '../../home/hooks/useHomeResource.js';
import { loadVehicleFilters, searchVehicles } from '../api/reservationsApi.js';
import ReservationLayout from '../components/ReservationLayout.jsx';
import VehicleSummary from '../components/VehicleSummary.jsx';
import { earliestTripMinute, errorMessage, minuteMs, money, services, toTripTime } from '../reservationFormat.js';

const initialFilters = { minSeats: 1, page: 1 };
const timeMessages = {
  startAt: 'Giờ bắt đầu phải hợp lệ và không được trước thời điểm hiện tại.',
  endAt: 'Giờ kết thúc phải hợp lệ và không được trước giờ bắt đầu.',
};

function buildPriceRanges(prices) {
  return prices.map((minPrice, index) => {
    const nextPrice = prices[index + 1];
    return {
      minPrice,
      priceBelow: nextPrice,
      label: nextPrice === undefined
        ? `Từ ${money(minPrice)} trở lên`
        : `${money(minPrice)} đến dưới ${money(nextPrice)}`,
    };
  });
}

function VehicleCatalog({ minSeats, serviceType, catalogSearch }) {
  const [filters, setFilters] = useState(() => ({ ...initialFilters, minSeats: minSeats ?? initialFilters.minSeats }));
  const [timeError, setTimeError] = useState('');
  const [earliestStart, setEarliestStart] = useState(earliestTripMinute);
  const [selectedStart, setSelectedStart] = useState('');
  const vehicles = useHomeResource(searchVehicles, filters);
  const filterOptions = useHomeResource(loadVehicleFilters);
  const seatOptions = [...new Set([
    ...(minSeats === undefined ? [] : [minSeats]),
    ...(filterOptions.data?.seats ?? []),
  ])].sort((a, b) => a - b);
  const priceRanges = buildPriceRanges(filterOptions.data?.prices ?? []);
  const earliestEnd = selectedStart > earliestStart ? selectedStart : earliestStart;

  useEffect(() => {
    let timer;
    function refresh() {
      const now = Date.now();
      setEarliestStart(earliestTripMinute(now));
      timer = setTimeout(refresh, minuteMs - now % minuteMs + 1);
    }
    refresh();
    return () => clearTimeout(timer);
  }, []);

  function updateTimeBounds() {
    setEarliestStart(earliestTripMinute());
  }

  function showTimeError(event) {
    event.preventDefault();
    setTimeError(event.currentTarget.name);
    event.currentTarget.focus();
  }

  function handleTimeInput(event) {
    const { name, value } = event.currentTarget;
    const start = event.currentTarget.form.elements.namedItem('startAt').value;
    const minimum = earliestTripMinute();
    const limit = name === 'endAt' && start > minimum ? start : minimum;
    setSelectedStart(start);
    setEarliestStart(minimum);
    setTimeError(value && value < limit ? name : '');
  }

  function search(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const { startAt, endAt, type, minSeats, priceRange } = values;
    const startTime = toTripTime(startAt);
    const endTime = toTripTime(endAt);
    if (startAt || endAt) {
      const start = Date.parse(startTime);
      const end = Date.parse(endTime);
      let field;
      if (!Number.isFinite(start) || start < Date.now()) {
        field = 'startAt';
      } else if (!Number.isFinite(end) || end < start) {
        field = 'endAt';
      }
      if (field) {
        setTimeError(field);
        event.currentTarget.elements.namedItem(field).focus();
        return;
      }
    }
    setTimeError('');
    const selectedRange = priceRanges.find(({ minPrice }) => String(minPrice) === priceRange);
    setFilters({
      page: 1,
      type: type || undefined,
      minSeats: Number(minSeats) || initialFilters.minSeats,
      minPrice: selectedRange?.minPrice,
      priceBelow: selectedRange?.priceBelow,
      startAt: startTime, endAt: endTime,
    });
  }

  return (
    <ReservationLayout publicPage>
      <div className="rv-heading"><h1>Tìm xe cho chuyến đi</h1><p>Chọn xe theo số chỗ, giá thuê và lịch sử dụng.</p></div>
      <form onSubmit={search} className="rv-panel rv-filters">
        <label>Loại xe<select name="type"><option value="">Tất cả</option>{filterOptions.data?.types.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Số chỗ tối thiểu
          <select name="minSeats" defaultValue={minSeats ?? ''}>
            <option value="">Tất cả số chỗ</option>
            {seatOptions.map((seats) => <option key={seats} value={seats}>{seats} chỗ trở lên</option>)}
          </select>
        </label>
        <label>Khoảng giá thuê / ngày
          <select name="priceRange">
            <option value="">Tất cả mức giá</option>
            {priceRanges.map(({ label, minPrice }) => <option key={minPrice} value={minPrice}>{label}</option>)}
          </select>
        </label>
        <label>Bắt đầu (giờ VN)
          <input type="datetime-local" name="startAt" min={earliestStart} onFocus={updateTimeBounds}
            onInput={handleTimeInput} onInvalid={showTimeError}
            aria-invalid={timeError === 'startAt' || undefined}
            aria-describedby={timeError === 'startAt' ? 'vehicle-time-error' : undefined}/>
        </label>
        <label>Kết thúc (giờ VN)
          <input type="datetime-local" name="endAt" min={earliestEnd} onFocus={updateTimeBounds}
            onInput={handleTimeInput} onInvalid={showTimeError}
            aria-invalid={timeError === 'endAt' || undefined}
            aria-describedby={timeError === 'endAt' ? 'vehicle-time-error' : undefined}/>
        </label>
        <button className="rv-button rv-primary" type="submit">Tìm xe</button>
        {timeError && <p id="vehicle-time-error" role="alert" className="rv-error rv-filter-error">{timeMessages[timeError]}</p>}
        {filterOptions.error && <p role="alert" className="rv-error rv-filter-error">Chưa tải được lựa chọn lọc xe.</p>}
      </form>
      {vehicles.loading && <p role="status">Đang tìm xe…</p>}
      {vehicles.error && <p role="alert" className="rv-error">{errorMessage(vehicles.error, 'Chưa thể tải danh sách xe.')}</p>}
      {vehicles.data && (vehicles.data.vehicles.length ? (
        <div className="rv-vehicle-grid">
          {vehicles.data.vehicles.map((vehicle) => (
            <article className="rv-panel rv-vehicle-card" key={vehicle.vehicle_id || vehicle._id}>
              <VehicleSummary vehicle={vehicle}/>
              {vehicle.vehicle_id && <Link className="rv-button rv-primary"
                to={'/vehicles/' + vehicle.vehicle_id}
                state={{ startAt: filters.startAt, endAt: filters.endAt, serviceType, catalogSearch }}>Xem chi tiết</Link>}
            </article>
          ))}
        </div>
      ) : <p className="rv-panel">Không có xe phù hợp. Hãy thử đổi bộ lọc.</p>)}
      {(filters.page > 1 || vehicles.data?.hasNext) && <div className="rv-actions" aria-label="Phân trang danh sách xe">
        <button className="rv-button" type="button" disabled={vehicles.loading || filters.page === 1}
          onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Trang trước</button>
        <span>Trang {filters.page}</span>
        <button className="rv-button" type="button" disabled={vehicles.loading || !vehicles.data?.hasNext}
          onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Trang tiếp</button>
      </div>}
    </ReservationLayout>
  );
}

export default function VehicleCatalogPage() {
  const [params] = useSearchParams();
  const rawMinSeats = params.get('minSeats');
  const seats = Number(rawMinSeats);
  const minSeats = /^[1-9]\d*$/.test(rawMinSeats ?? '') && Number.isSafeInteger(seats) ? seats : undefined;
  const serviceType = services.find(({ value }) => value === params.get('service'))?.value;
  const query = params.toString();

  return <VehicleCatalog key={query} minSeats={minSeats} serviceType={serviceType} catalogSearch={query ? '?' + query : ''}/>;
}

