import { createElement as h, useEffect, useRef, useState } from 'react';
import { getListings } from '../../listings/api/listingApi';
import { getHomepage } from '../api/homeApi';
import { getCurrentUser, getLoginDestination } from '../../auth/session';
import renderTravelHomepage from './travelHomepageTemplate';
import './travelHomepageUtilities.css';
import './TravelHomePage.css';

const seatCounts = { sedan4: 4, suv7: 7, limo9: 9, solati16: 16, thaco29: 29 };
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

function normalize(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function SearchResults({ result }) {
  if (!result) return null;

  return h('section', { className: 'vt-search-results', 'aria-live': 'polite', id: 'ket-qua-tim-xe' },
    h('h2', null, 'Xe tự lái tham khảo từ XeDi'),
    h('p', null, 'Để nhận báo giá dịch vụ có tài xế, hãy liên hệ hotline trong mẫu.'),
    h('p', null, result.message),
    result.listings?.length > 0 && h('div', { className: 'vt-result-grid' },
      result.listings.map((listing) => h('a', { key: listing._id, href: '/#/xe/' + listing._id },
        h('strong', null, listing.title || [listing.vehicle?.brand, listing.vehicle?.model].filter(Boolean).join(' ')),
        h('span', null, [listing.pickup_location?.city, money.format(listing.daily_price) + '/ngày'].filter(Boolean).join(' · ')),
      )),
    ),
    h('a', { className: 'vt-live-fleet-link', href: '/xe-tu-lai' }, 'Xem danh sách xe tự lái'),
  );
}

export default function TravelHomePage() {
  const [mode, setMode] = useState('roundtrip');
  const [fleetFilter, setFleetFilter] = useState('all');
  const [account, setAccount] = useState(getCurrentUser);
  const [result, setResult] = useState(null);
  const [cities, setCities] = useState([]);
  const activeRequest = useRef(null);
  const detailsDialog = useRef(null);
  const [details, setDetails] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const updateAccount = () => setAccount(getCurrentUser());
    getHomepage({ signal: controller.signal }).then(({ data }) => setCities(data.cities || [])).catch(() => {});
    window.addEventListener('xedi:session', updateAccount);
    window.addEventListener('storage', updateAccount);
    return () => {
      controller.abort();
      activeRequest.current?.abort();
      window.removeEventListener('xedi:session', updateAccount);
      window.removeEventListener('storage', updateAccount);
    };
  }, []);

  useEffect(() => {
    if (details && !detailsDialog.current?.open) detailsDialog.current?.showModal();
  }, [details]);

  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const { mode: selectedMode, filter, vehicle, scroll, details: showDetails } = button.dataset;
    if (showDetails) {
      setDetails(button.closest('[data-fleet]')?.querySelector('h3')?.textContent.trim() || 'Xe tham khảo');
      return;
    }
    if (selectedMode) setMode(selectedMode);
    if (filter) setFleetFilter(filter);
    if (vehicle) {
      setMode('roundtrip');
      const vehicleSelect = document.getElementById('booking-form-roundtrip')?.elements.vehicle;
      if (vehicleSelect) vehicleSelect.value = vehicle;
      scrollToSection('tim-xe');
    }
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
    const city = cities.find((name) => normalize(pickup).includes(normalize(name)));
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
        message: data.length ? 'Kết quả theo hạng xe đã chọn.' : 'Chưa có xe tự lái phù hợp với lựa chọn của bạn.',
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
    results: h('div', null,
      h(SearchResults, { result }),
      h('dialog', { className: 'vt-detail-dialog', ref: detailsDialog, onClose: () => setDetails('') },
        h('h2', null, details),
        h('p', null, 'Mẫu xe minh họa. Liên hệ hotline để hỏi về hạng xe, giá và lịch phục vụ.'),
        h('a', { href: 'tel:19006886' }, 'Hotline 1900 6886'),
        h('button', { type: 'button', onClick: () => detailsDialog.current?.close() }, 'Đóng'),
      ),
    ),
    onClick: handleClick,
    onSubmit: handleSubmit,
  });
}
