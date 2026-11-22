import { createElement as h, useEffect, useRef, useState } from 'react';
import { getListings } from '../../listings/api/listingApi';
import { listingPhoto } from '../../listings/components/VehicleCard';
import useListings from '../../listings/hooks/useListings';
import { getHomepage } from '../api/homeApi';
import { getCurrentUser, getLoginDestination } from '../../auth/session';
import renderTravelHomepage from './travelHomepageTemplate';
import './travelHomepageUtilities.css';
import './TravelHomePage.css';

const seatCounts = { sedan4: 4, suv7: 7, limo9: 9, solati16: 16, thaco29: 29 };
const fleetFilters = { all: {}, 4: { seats: 4 }, 7: { seats: 7 }, 9: { seats: 9 }, 16: { seats: 16 } };
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

function normalize(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function SearchResults({ result }) {
  if (!result) return null;

  return h('section', { className: 'vt-search-results', 'aria-live': 'polite', id: 'ket-qua-tim-xe' },
    h('h2', null, 'Kết quả tìm xe'),
    h('p', null, 'Liên hệ hotline để xác nhận giá và lịch phục vụ.'),
    h('p', null, result.message),
    result.listings?.length > 0 && h('div', { className: 'vt-result-grid' },
      result.listings.map((listing) => h(listing.source === 'viet_tour' ? 'article' : 'a', {
        key: listing._id,
        href: listing.source === 'viet_tour' ? undefined : '/#/xe/' + listing._id,
      },
        h('strong', null, listing.title || [listing.vehicle?.brand, listing.vehicle?.model].filter(Boolean).join(' ')),
        h('span', null, [listing.pickup_location?.city, money.format(listing.daily_price) + '/ngày'].filter(Boolean).join(' · ')),
      )),
    ),
    h('a', { className: 'vt-live-fleet-link', href: '/xe-tu-lai' }, 'Xem danh sách xe tự lái'),
  );
}

function FleetCard({ listing }) {
  const { vehicle, pickup_location: pickupLocation } = listing;
  const photo = listingPhoto(listing);
  const title = listing.title || [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ');

  return h('article', { className: 'vt-fleet-card' },
    h('div', { className: 'vt-fleet-photo' }, photo.illustration
      ? h('span', null, 'Chưa có ảnh xe')
      : h('img', { src: photo.src, alt: title, loading: 'lazy' })),
    h('div', { className: 'vt-fleet-info' },
      h('h3', null, title),
      h('p', null, [vehicle?.seats && vehicle.seats + ' chỗ', pickupLocation?.city].filter(Boolean).join(' · ')),
      h('strong', null, money.format(listing.daily_price), ' / ngày'),
      listing.source === 'viet_tour'
        ? h('a', { className: 'vt-account-link', href: 'tel:19006886' }, 'Liên hệ đặt xe')
        : h('a', { className: 'vt-account-link', href: '/#/xe/' + listing._id }, 'Chi tiết xe'),
    ),
  );
}

function FeaturedFleet({ listings, loading, error, setRetry }) {
  if (loading) return h('p', { role: 'status' }, 'Đang tải danh sách xe…');
  if (error) return h('div', { role: 'status' },
    h('p', null, 'Chưa thể tải danh sách xe.'),
    h('button', { type: 'button', onClick: () => setRetry((value) => value + 1) }, 'Thử lại'),
  );
  if (!listings.length) return h('p', { className: 'vt-fleet-empty' }, 'Chưa có xe đang niêm yết phù hợp.');
  return h('div', { className: 'vt-fleet-grid' },
    listings.map((listing) => h(FleetCard, { key: listing._id, listing })),
  );
}

export default function TravelHomePage() {
  const [mode, setMode] = useState('roundtrip');
  const [fleetFilter, setFleetFilter] = useState('all');
  const [account, setAccount] = useState(getCurrentUser);
  const [result, setResult] = useState(null);
  const [homepage, setHomepage] = useState(null);
  const fleet = useListings({ filters: fleetFilters[fleetFilter], sort: 'newest', limit: 4 });
  const activeRequest = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const updateAccount = () => setAccount(getCurrentUser());
    getHomepage({ signal: controller.signal }).then(({ data }) => setHomepage(data)).catch(() => {});
    window.addEventListener('xedi:session', updateAccount);
    window.addEventListener('storage', updateAccount);
    return () => {
      controller.abort();
      activeRequest.current?.abort();
      window.removeEventListener('xedi:session', updateAccount);
      window.removeEventListener('storage', updateAccount);
    };
  }, []);

  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const { mode: selectedMode, filter, scroll } = button.dataset;
    if (selectedMode) setMode(selectedMode);
    if (filter) setFleetFilter(filter);
    if (scroll) scrollToSection(scroll);
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!form.dataset.booking) return;
    event.preventDefault();
    activeRequest.current?.abort();

    const inputs = new FormData(form);
    const pickup = inputs.get('pickup').trim();
    const destination = inputs.get('destination').trim();
    const params = { limit: 8, seats: seatCounts[inputs.get('vehicle')] };
    if (!pickup || !destination) {
      setResult({ message: 'Vui lòng điền điểm đón và điểm đến hoặc lộ trình.' });
      return;
    }
    const city = homepage?.cities?.find((name) => normalize(pickup).includes(normalize(name)));
    if (city) params.city = city;
    if (form.dataset.booking === 'roundtrip') {
      const start = new Date(inputs.get('startAt'));
      const end = new Date(inputs.get('endAt'));
      if (!Number.isFinite(+start) || !Number.isFinite(+end) || start <= new Date() || end <= start) {
        setResult({ message: 'Chọn thời gian đón trong tương lai và thời gian về sau giờ đón.' });
        return;
      }
      params.startAt = start.toISOString();
      params.endAt = end.toISOString();
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    setResult({ message: 'Đang tra cứu danh sách xe…' });
    try {
      const { data } = await getListings(params, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setResult({
        listings: data,
        message: data.length ? 'Kết quả theo hạng xe đã chọn.' : 'Chưa có xe phù hợp với lựa chọn của bạn.',
      });
    } catch {
      if (!controller.signal.aborted) setResult({ message: 'Chưa thể tra cứu danh sách xe. Vui lòng thử lại.' });
    }
  }

  return renderTravelHomepage({
    mode,
    fleetFilter,
    account: h('a', { className: 'vt-account-link', href: account ? getLoginDestination(account) : '/login' },
      account ? 'Tài khoản' : 'Đăng nhập',
    ),
    overview: homepage?.totalListings > 0
      ? h('p', { className: 'vt-home-overview' }, homepage.totalListings.toLocaleString('vi-VN'), ' xe đang niêm yết')
      : null,
    fleet: h(FeaturedFleet, fleet),
    results: h(SearchResults, { result }),
    onClick: handleClick,
    onSubmit: handleSubmit,
  });
}
