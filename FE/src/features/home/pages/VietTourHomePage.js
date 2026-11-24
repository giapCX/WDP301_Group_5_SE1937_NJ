import { createElement as h, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { loadReviews, loadVehicles } from '../api/homeApi.js';
import BookingSearch from '../components/BookingSearch.js';
import Icon from '../components/HomeIcon.js';
import VehicleGrid from '../components/VehicleGrid.js';
import { getSession } from '../../auth/api/authApi.js';
import useSignOut from '../../auth/hooks/useSignOut.js';
import { dashboardForRole } from '../../auth/dashboardRoutes.js';
import useHomeResource from '../hooks/useHomeResource.js';
import { destinations, hotline, services, standards } from '../homeContent.js';
import { heroPhoto, routePhoto } from '../homePhotos.js';
import '../styles/homepage.css';

const nav = [['Trang chủ', '#trang-chu'], ['Dịch vụ', '#dich-vu'], ['Đội xe', '#doi-xe'],
  ['Điểm đến', '#diem-den'], ['Đánh giá', '#danh-gia']];

function Result({ state, children, label }) {
  if (state.loading) return h('p', { className: 'vt-h-status', role: 'status' }, 'Đang tải ' + label + '…');
  if (state.error) return h('p', { className: 'vt-h-status', role: 'alert' }, 'Chưa thể tải ' + label + '.');
  return children(state.data);
}

function Footer() {
  return h('footer', { className: 'vt-h-footer' },
    h('div', { className: 'vt-h-wrap vt-h-footer-grid' },
      h('div', null, h(Link, { className: 'vt-h-brand', to: '/' }, 'VietTour'),
        h('p', null, 'Thuê xe du lịch theo lịch trình của bạn.')),
      h('div', null, h('h2', null, 'Dịch vụ'),
        h('a', { href: '#dich-vu' }, 'Đưa đón khứ hồi'),
        h('a', { href: '#dich-vu' }, 'Tham quan theo tour'),
        h('a', { href: '#doi-xe' }, 'Danh sách xe')),
      h('div', null, h('h2', null, 'Đội ngũ & cam kết'),
        h('a', { href: '#cam-ket' }, 'Thông tin dịch vụ'),
        h('a', { href: '#diem-den' }, 'Gợi ý điểm đến'),
        h('a', { href: '#danh-gia' }, 'Đánh giá')),
      h('div', null, h('h2', null, 'Liên hệ'),
        h('a', { href: hotline.href }, hotline.label),
        h('a', { href: '#tim-xe' }, 'Tra cứu lịch xe')),
    ),
    h('p', { className: 'vt-h-wrap vt-h-footer-bottom' }, '© VietTour Mobility'),
  );
}

export default function VietTourHomePage() {
  const { hash, search: queryString } = useLocation();
  const requestedService = new URLSearchParams(queryString).get('service');
  const [mode, setMode] = useState(requestedService === 'tour' ? 'tour' : 'roundtrip');
  const [destination, setDestination] = useState('');
  const [query, setQuery] = useState(null);
  const searching = Boolean(query?.startAt);
  const vehicles = useHomeResource(loadVehicles, query);
  const reviews = useHomeResource(loadReviews);
  const selectedSeats = query?.minSeats || 7;
  const session = useHomeResource(getSession);
  const [signedOut, setSignedOut] = useState(false);
  const { error: signOutError, signingOut, signOut } = useSignOut({
    redirectTo: null,
    onSuccess: () => setSignedOut(true),
  });
  const user = signedOut ? null : session.data;

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  function showSearch(service) {
    setMode(service);
    document.getElementById('tim-xe')?.scrollIntoView({ behavior: 'smooth' });
  }

  function search(filters) {
    setQuery(filters);
    document.getElementById('doi-xe')?.scrollIntoView({ behavior: 'smooth' });
  }

  function filterSeats(minSeats) {
    setQuery((previous) => ({ ...previous, minSeats }));
  }

  return h('div', { className: 'vt-homepage' },
    h('header', { className: 'vt-h-header' },
      h('div', { className: 'vt-h-wrap vt-h-header-inner' },
        h(Link, { className: 'vt-h-brand', to: '/' }, h(Icon, { name: 'directions_car' }), 'VietTour'),
        h('nav', { 'aria-label': 'Điều hướng chính' },
          nav.map(([label, href]) => h('a', { key: href, href }, label))),
        h('div', { className: 'vt-h-header-actions' },
          h('a', { className: 'vt-h-header-hotline', href: hotline.href }, hotline.label),
          h('div', { className: 'vt-h-auth-links' },
            h(Link, { to: '/login', className: 'vt-h-outline' }, 'Đăng nhập'),
            h(Link, { to: '/register', className: 'vt-h-outline' }, 'Đăng ký'),
            user && h(Link, { to: dashboardForRole(user.role_name), className: 'vt-h-outline' }, user.full_name),
            user && h('button', { type: 'button', className: 'vt-h-outline', onClick: signOut, disabled: signingOut }, signingOut ? 'Đang đăng xuất…' : 'Đăng xuất')),
          h('a', { href: '#tim-xe', className: 'vt-h-button' }, 'Tìm xe')),
      ),
    ),
    signOutError && h('p', { className: 'vt-h-auth-error', role: 'alert' }, signOutError),
    h('main', null,
      h('section', { id: 'trang-chu', className: 'vt-h-hero', style: { '--vt-h-photo': 'url("' + heroPhoto + '")' } },
        h('div', { className: 'vt-h-wrap' },
          h('p', { className: 'vt-h-hero-label' }, 'Xe du lịch VietTour'),
          h('h1', null, 'Trải nghiệm du lịch trọn vẹn cùng xe đời mới & tài xế riêng tận tâm'),
          h('p', null, 'Chọn xe cho chuyến đưa đón khứ hồi hoặc hành trình nhiều điểm dừng.'),
          h('div', { className: 'vt-h-benefits' }, standards.map(([icon, title]) =>
            h('span', { key: title }, h(Icon, { name: icon }), title))),
        ),
      ),
      h(BookingSearch, { mode, onModeChange: setMode, destination, onDestinationChange: setDestination, onSearch: search }),
      h('section', { className: 'vt-h-wrap vt-h-section', id: 'dich-vu' },
        h('div', { className: 'vt-h-section-intro' },
          h('h2', null, 'Chọn dịch vụ phù hợp cho chuyến đi của bạn'),
          h('p', null, 'Chọn đưa đón theo giờ hẹn hoặc thuê xe đi cùng trong suốt lộ trình.')),
        h('div', { className: 'vt-h-services' }, services.map((service) => h('article', { key: service.id },
          h(Icon, { name: service.icon }),
          h('h3', null, service.title), h('p', null, service.description),
          h('ul', null, service.details.map((detail) => h('li', { key: detail }, detail))),
          h('ol', { className: 'vt-h-service-steps', 'aria-label': 'Lộ trình' },
            service.steps.map((step) => h('li', { key: step }, step))),
          h('div', { className: 'vt-h-service-action' },
            h('small', null, service.fit),
            h('button', { type: 'button', className: 'vt-h-outline', onClick: () => showSearch(service.id) }, 'Tìm xe')),
        ))),
      ),
      h('section', { className: 'vt-h-wrap vt-h-section', id: 'doi-xe' },
        h('div', { className: 'vt-h-fleet-header' },
          h('h2', null, searching ? 'Kết quả tìm xe' : 'Đội xe du lịch tiêu biểu'),
          h('div', { className: 'vt-h-chips', role: 'group', 'aria-label': 'Lọc số chỗ' },
            [7, 9, 16, 29].map((seats) => h('button', {
              key: seats, type: 'button', 'aria-pressed': selectedSeats === seats,
              onClick: () => filterSeats(seats),
            }, 'Từ ' + seats + ' chỗ')),
            searching && h('button', { type: 'button', onClick: () => setQuery(null) }, 'Bỏ lọc lịch'),
          ),
        ),
        h(Result, { state: vehicles, label: 'đội xe' }, (data) => h(VehicleGrid, { vehicles: data, hotline: hotline.href })),
      ),
      h('section', { className: 'vt-h-wrap vt-h-section', id: 'cam-ket' },
        h('div', { className: 'vt-h-standards' },
          h('h2', null, '4 cam kết cho chuyến đi an tâm'),
          h('div', { className: 'vt-h-standards-grid' }, standards.map(([icon, title, description]) =>
            h('article', { key: title }, h(Icon, { name: icon }), h('h3', null, title), h('p', null, description)))),
        ),
      ),
      h('section', { className: 'vt-h-wrap vt-h-section vt-h-destinations', id: 'diem-den' },
        h('div', null,
          h('h2', null, 'Khám phá các điểm đến du lịch'),
          h('ul', null, destinations.map(({ name, description }) => h('li', { key: name },
            h(Icon, { name: 'location_on' }),
            h('div', null, h('button', {
              type: 'button', className: 'vt-h-destination-button',
              onClick: () => { setDestination(name); showSearch('roundtrip'); },
            }, name), h('p', null, description))))),
        ),
        h('img', { src: routePhoto, alt: 'Bản đồ minh họa hành trình du lịch', loading: 'lazy' }),
      ),
      h('section', { className: 'vt-h-wrap vt-h-section', id: 'danh-gia' },
        h('h2', null, 'Cảm nhận từ khách hàng'),
        h(Result, { state: reviews, label: 'đánh giá' }, (data) => data.length
          ? h('div', { className: 'vt-h-review-grid' }, data.map((review) =>
            h('blockquote', { key: review._id },
              Number.isFinite(review.rating) && h('strong', null, review.rating, '/5'),
              h('p', null, review.comment))))
          : h('p', { className: 'vt-h-status' }, 'Chưa có đánh giá được công bố.')),
        h('div', { className: 'vt-h-contact' },
          h('div', null, h('h3', null, 'Cần hỗ trợ cho chuyến đi?'),
            h('p', null, 'Trao đổi với VietTour về lịch trình và giá thuê.')),
          h('a', { className: 'vt-h-button', href: hotline.href }, 'Hotline ', hotline.label),
        ),
      ),
    ),
    h(Footer),
  );
}
