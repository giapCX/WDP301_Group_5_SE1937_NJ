import { createElement as h, useEffect, useState } from 'react';
import Icon from '../../../components/Icon';
import { getSessionToken } from '../../auth/session';
import { listingPhoto } from '../../listings/components/VehicleCard';
import { getRenter, vnd } from '../api/renterApi';
import '../styles/viettour-trip-search.css';

const serviceNames = { roundtrip: 'Đưa đón khứ hồi', tour: 'Tham quan theo tour' };
const seatOptions = ['', '4', '7', '9', '16', '29'];
const defaultFilters = { seats: '', brand: '', maxPrice: '', sort: 'newest' };

function datetime(value) {
  return new Date(value + '+07:00');
}

function field(label, element) {
  return h('label', null, h('span', null, label), element);
}

function selectOption(value, label) {
  return h('option', { key: value, value }, label);
}

function VehicleResult({ listing, onChoose }) {
  const photo = listingPhoto(listing);
  const car = listing.vehicle;
  return h('article', { className: 'vt-trip-car' },
    h('div', { className: 'vt-trip-car-photo' }, photo.illustration
      ? h(Icon, { name: 'car', size: 48 })
      : h('img', { src: photo.src, alt: listing.title, loading: 'lazy' })),
    h('div', { className: 'vt-trip-car-content' },
      h('h3', null, listing.title || [car?.brand, car?.model].filter(Boolean).join(' ')),
      h('div', { className: 'vt-trip-car-specs' },
        car?.seats && h('span', null, h(Icon, { name: 'people', size: 15 }), car.seats, ' chỗ'),
        car?.vehicle_type && h('span', null, h(Icon, { name: 'car', size: 15 }), car.vehicle_type),
        listing.pickup_location?.city && h('span', null, listing.pickup_location.city),
      ),
      h('div', { className: 'vt-trip-car-price' },
        h('span', null, 'Giá theo ngày'),
        h('strong', null, vnd(listing.daily_price)),
      ),
    ),
    h('footer', { className: 'vt-trip-car-action' },
      h('button', { type: 'button', className: 'vt-trip-primary', onClick: () => onChoose(listing) }, 'Chọn xe'),
    ),
  );
}

export default function VietTourTripSearch({ route }) {
  const presets = new URLSearchParams(route.split('?')[1]);
  const [draft, setDraft] = useState(() => ({
    pickup: '', destination: '', startAt: '', endAt: '', passengers: '2',
    service: presets.get('service') === 'tour' ? 'tour' : 'roundtrip',
  }));
  const [filters, setFilters] = useState(() => ({
    ...defaultFilters, seats: presets.get('vehicle') === 'limo9' ? '9' : '',
  }));
  const [criteria, setCriteria] = useState(null);
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState({ loading: true });
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!getSessionToken()) {
      setResult({ error: { status: 401 } });
      return () => controller.abort();
    }
    setResult({ loading: true });
    const query = new URLSearchParams({ page, limit: 6, sort: filters.sort });
    if (filters.brand.trim()) query.set('brand', filters.brand.trim());
    if (filters.maxPrice) query.set('maxPrice', filters.maxPrice);
    if (filters.seats && Number(filters.seats) >= (criteria?.minSeats ?? 0)) {
      query.set('seats', filters.seats);
    } else if (criteria?.minSeats) {
      query.set('minSeats', criteria.minSeats);
    }
    if (criteria) {
      query.set('startAt', criteria.startAt);
      query.set('endAt', criteria.endAt);
    }
    getRenter('/trip-vehicles?' + query, { signal: controller.signal })
      .then(({ data, pagination }) => {
        if (!controller.signal.aborted) setResult({ data, pagination });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ error });
      });
    return () => controller.abort();
  }, [criteria, filters, page, retry]);

  function submitTrip(event) {
    event.preventDefault();
    const start = datetime(draft.startAt);
    const end = datetime(draft.endAt);
    const passengers = Number(draft.passengers);
    const pickup = draft.pickup.trim();
    const destination = draft.destination.trim();
    if (!pickup || !destination || !Number.isInteger(passengers) || passengers < 1 || passengers > 49) {
      setFormError('Nhập điểm đón, điểm đến và số khách từ 1 đến 49.');
      return;
    }
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || start <= new Date() || end <= start) {
      setFormError('Chọn giờ đón trong tương lai và giờ kết thúc sau giờ đón.');
      return;
    }
    setFormError('');
    setPage(1);
    setSelected(null);
    if (filters.seats && Number(filters.seats) < passengers + 1) {
      setFilters((current) => ({ ...current, seats: '' }));
    }
    setCriteria({
      ...draft, pickup, destination, startAt: start.toISOString(), endAt: end.toISOString(),
      minSeats: passengers + 1,
    });
  }

  function updateFilter(name, value) {
    setPage(1);
    setSelected(null);
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function tripField(name, label, props) {
    return field(label, h('input', {
      ...props,
      value: draft[name],
      onChange: (event) => setDraft((current) => ({ ...current, [name]: event.target.value })),
    }));
  }

  if ([401, 403].includes(result.error?.status)) {
    return h('main', { className: 'vt-trip-search vt-trip-denied' },
      h('h1', null, 'Đặt chuyến đi mới'),
      h('p', null, 'Đăng nhập bằng tài khoản người thuê để tìm xe.'),
      h('a', { className: 'vt-trip-primary', href: '/login' }, 'Đăng nhập người thuê'),
    );
  }

  return h('div', { className: 'vt-trip-search' },
    h('header', { className: 'vt-trip-header' },
      h('a', { href: '/', className: 'vt-trip-brand' }, h(Icon, { name: 'car' }), 'VietTour'),
      h('a', { href: '/#/renter' }, 'Không gian người thuê'),
    ),
    h('main', { className: 'vt-trip-wrap' },
      h('nav', { className: 'vt-trip-breadcrumb', 'aria-label': 'Đường dẫn' },
        h('a', { href: '/#/renter' }, 'Người thuê'), ' / ', h('span', null, 'Danh sách xe du lịch'),
      ),
      h('div', { className: 'vt-trip-title' },
        h('h1', null, 'Khám phá đội xe du lịch'),
        h('p', null, 'Chọn lộ trình, thời gian và số khách để tìm xe phù hợp cho chuyến đi.'),
      ),
      h('form', { className: 'vt-trip-itinerary', onSubmit: submitTrip, 'aria-label': 'Thông tin hành trình' },
        tripField('pickup', 'Điểm đón', { required: true, maxLength: 200, placeholder: 'Địa chỉ hoặc sân bay' }),
        tripField('destination', 'Điểm đến', { required: true, maxLength: 200, placeholder: 'Địa chỉ hoặc lộ trình' }),
        tripField('startAt', 'Giờ đón (giờ Việt Nam)', { type: 'datetime-local', required: true }),
        tripField('endAt', 'Giờ kết thúc (giờ Việt Nam)', { type: 'datetime-local', required: true, min: draft.startAt }),
        tripField('passengers', 'Số khách', { type: 'number', required: true, min: 1, max: 49 }),
        field('Loại dịch vụ', h('select', { value: draft.service,
          onChange: (event) => setDraft((current) => ({ ...current, service: event.target.value })) },
          Object.entries(serviceNames).map(([key, label]) => selectOption(key, label)),
        )),
        h('button', { className: 'vt-trip-primary', type: 'submit' }, 'Tìm xe'),
        formError && h('p', { className: 'vt-trip-form-error', role: 'alert' }, formError),
      ),
      h('div', { className: 'vt-trip-layout' },
        h('aside', { className: 'vt-trip-filters' },
          h('div', { className: 'vt-trip-filters-title' },
            h('h2', null, 'Bộ lọc tìm kiếm'),
            h('button', { type: 'button', onClick: () => { setPage(1); setSelected(null); setFilters(defaultFilters); } }, 'Xóa lọc'),
          ),
          field('Số chỗ', h('select', { value: filters.seats, onChange: (event) => updateFilter('seats', event.target.value) },
            seatOptions.map((seat) => h('option', { key: seat, value: seat,
              disabled: Boolean(seat && criteria && Number(seat) < criteria.minSeats) }, seat ? seat + ' chỗ' : 'Tất cả'),
            ),
          )),
          field('Hãng xe', h('input', { value: filters.brand, maxLength: 60, placeholder: 'Ví dụ Toyota',
            onChange: (event) => updateFilter('brand', event.target.value) })),
          field('Giá tối đa/ngày (₫)', h('input', { value: filters.maxPrice, type: 'number', min: 0, step: 10000,
            placeholder: 'Không giới hạn', onChange: (event) => updateFilter('maxPrice', event.target.value) })),
        ),
        h('section', { className: 'vt-trip-results', 'aria-label': 'Kết quả tìm xe' },
          h('div', { className: 'vt-trip-results-bar' },
            h('h2', null, result.pagination ? result.pagination.total + ' xe phù hợp' : 'Danh sách xe'),
            field('Sắp xếp', h('select', { value: filters.sort, onChange: (event) => updateFilter('sort', event.target.value) },
              selectOption('newest', 'Mới nhất'), selectOption('price_asc', 'Giá tăng dần'), selectOption('price_desc', 'Giá giảm dần'),
            )),
          ),
          result.loading && h('p', { role: 'status' }, 'Đang tải danh sách xe…'),
          result.error && h('div', { role: 'alert', className: 'vt-trip-notice' },
            h('p', null, result.error.message), h('button', { type: 'button', onClick: () => setRetry((value) => value + 1) }, 'Thử lại'),
          ),
          result.data?.length === 0 && h('p', { className: 'vt-trip-notice' }, 'Chưa có xe phù hợp. Hãy đổi thời gian hoặc bộ lọc.'),
          result.data?.map((listing) => h(VehicleResult, {
            key: listing._id, listing, onChoose: setSelected,
          })),
          selected && h('div', { className: 'vt-trip-notice', role: 'status' },
            h('strong', null, 'Xe đã chọn: ', selected.title),
            criteria && h('p', null, criteria.pickup, ' → ', criteria.destination, ' · ', serviceNames[criteria.service]),
            h('p', null, 'Liên hệ tổng đài để xác nhận lịch và giá trọn chuyến.'),
            h('a', { className: 'vt-trip-primary', href: 'tel:19006886' }, 'Liên hệ đặt xe'),
          ),
          result.pagination?.totalPages > 1 && h('nav', { className: 'vt-trip-pagination', 'aria-label': 'Trang kết quả' },
            h('button', { type: 'button', disabled: page <= 1, onClick: () => { setSelected(null); setPage(page - 1); } }, 'Trang trước'),
            h('span', null, page, ' / ', result.pagination.totalPages),
            h('button', { type: 'button', disabled: page >= result.pagination.totalPages, onClick: () => { setSelected(null); setPage(page + 1); } }, 'Trang sau'),
          ),
        ),
      ),
    ),
  );
}
