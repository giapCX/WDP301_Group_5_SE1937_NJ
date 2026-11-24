import { createElement as h } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import SignOutButton from '../../auth/components/SignOutButton.js';
import { LoginFooter } from '../../auth/pages/LoginLayout.js';
import Icon from '../../home/components/HomeIcon.js';
import { hotline } from '../../home/homeContent.js';
import useHomeResource from '../../home/hooks/useHomeResource.js';
import { loadRenterDashboard } from '../api/renterDashboardApi.js';
import '../styles/renterDashboard.css';

const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const statusLabels = new Map([
  ['confirmed', 'Đã xác nhận'], ['in_progress', 'Đang thực hiện'], ['completed', 'Hoàn thành'],
  ['cancelled', 'Đã hủy'], ['rejected', 'Đã từ chối'],
]);

const navigation = [
  ['Quản lý đơn đặt xe', '#tong-quan'], ['Chuyến đi hiện tại', '#chuyen-di'],
  ['Lịch sử chuyến đi', '#lich-su'], ['Ưu đãi', '#uu-dai'],
];
const metrics = [
  ['total', 'Tổng chuyến đã đặt', 'receipt_long'], ['completed', 'Chuyến đã hoàn thành', 'verified'],
  ['upcoming', 'Chuyến đi sắp tới', 'calendar_month'], ['offers', 'Ưu đãi đang có', 'redeem'],
];
const shortcuts = [
  ['flight_land', 'Đưa đón sân bay', 'Chọn điểm đón và giờ hẹn.', '/?service=roundtrip#tim-xe'],
  ['route', 'Thuê xe theo tour', 'Lên lịch chuyến đi qua nhiều điểm dừng.', '/?service=tour#tim-xe'],
  ['airport_shuttle', 'Limousine và xe đoàn', 'Xem đội xe từ 7 chỗ trở lên.', '/#doi-xe'],
  ['edit_road', 'Lộ trình tự thiết kế', 'Chọn điểm đến cho chuyến đi riêng.', '/#diem-den'],
];

function formatDate(value) {
  return value && Number.isFinite(+new Date(value)) ? date.format(new Date(value)) : 'Chưa xác định';
}

function TripDetails({ trip }) {
  const vehicle = [trip.vehicle?.brand, trip.vehicle?.model].filter(Boolean).join(' ');
  const photos = Array.isArray(trip.vehicle?.photos) ? trip.vehicle.photos : [];
  const photo = photos.find((url) => typeof url === 'string' && /^https?:\/\//i.test(url));
  const route = [trip.pickup_location, ...(trip.stops || []).map(({ location }) => location), trip.dropoff_location].filter(Boolean);
  return h('article', { className: 'vt-r-panel vt-r-trip' },
    h('aside', null,
      photo ? h('img', { src: photo, alt: vehicle, onError: (event) => { event.currentTarget.hidden = true; } })
        : h('div', { className: 'vt-r-trip-placeholder' }, h(Icon, { name: 'airport_shuttle' })),
      h('strong', null, vehicle || 'Chưa phân xe'),
      h('p', null, 'Đơn #' + trip.booking_id),
    ),
    h('div', null,
      h('span', { className: 'vt-r-badge' }, statusLabels.get(trip.booking_status) || 'Đang cập nhật'),
      h('h3', null, trip.pickup_location + ' → ' + trip.dropoff_location),
      h('p', null, formatDate(trip.pickup_time)),
      h('details', { open: true },
        h('summary', null, 'Chi tiết lộ trình'),
        h('ol', null, route.map((location, index) => h('li', { key: index }, location))),
      ),
      trip.update && h('p', null,
        'Cập nhật gần nhất · ', statusLabels.get(trip.update.trip_status) || trip.update.trip_status,
        ' · ', formatDate(trip.update.updated_at)),
      h('a', { href: hotline.href, className: 'vt-h-outline' }, 'Liên hệ điều phối'),
    ),
  );
}

function RenterContent({ data, user }) {
  return h('main', { className: 'vt-h-wrap vt-r-main' },
    h('section', { className: 'vt-r-hero', id: 'tong-quan' },
      h('div', null, h('span', { className: 'vt-r-hero-label' }, 'Tài khoản Người thuê'),
        h('h1', null, 'Chào mừng trở lại, ', user.full_name, '!'),
        h('p', null, 'Theo dõi lịch trình, xem lại các chuyến đã đặt và lên kế hoạch cho chuyến tiếp theo.')),
      h(Link, { to: '/#tim-xe', className: 'vt-h-button' }, h(Icon, { name: 'add_circle' }), 'Đặt chuyến đi mới'),
    ),
    h('section', { className: 'vt-r-grid vt-r-stats', 'aria-label': 'Tổng quan chuyến đi' },
      metrics.map(([key, label, icon]) => h('article', { className: 'vt-r-panel', key },
        h(Icon, { name: icon }), h('h2', null, label), h('strong', null, data.stats[key]))),
    ),
    h('section', { id: 'chuyen-di' },
      h('h2', { className: 'vt-r-title' }, 'Chuyến đi sắp khởi hành hoặc đang diễn ra'),
      data.currentTrip ? h(TripDetails, { trip: data.currentTrip })
        : h('div', { className: 'vt-r-panel' }, h('p', null, 'Bạn chưa có chuyến đang diễn ra hoặc sắp khởi hành.')),
    ),
    h('section', null,
      h('h2', { className: 'vt-r-title' }, 'Phím tắt đặt chuyến nhanh'),
      h('div', { className: 'vt-r-grid' }, shortcuts.map(([icon, label, description, to]) =>
        h(Link, { className: 'vt-r-panel vt-r-shortcut', key: label, to },
          h(Icon, { name: icon }), h('h3', null, label), h('p', null, description),
          h(Icon, { name: 'arrow_forward' }))))),
    h('div', { className: 'vt-r-columns' },
      h('section', { id: 'uu-dai' },
        h('h2', { className: 'vt-r-title' }, 'Ưu đãi đang có'),
        h('div', { className: 'vt-r-list' }, data.offers.length ? data.offers.map((offer) =>
          h('article', { className: 'vt-r-panel', key: offer.promotion_id },
            h('strong', null, offer.code), h('span', { className: 'vt-r-badge' }, 'Giảm ' + offer.discount_percent + '%'),
            h('p', null, 'Hạn sử dụng · ', formatDate(offer.valid_until))))
          : h('p', { className: 'vt-r-panel' }, 'Hiện chưa có ưu đãi.')),
        h('a', { className: 'vt-r-hotline', href: hotline.href },
          h('span', null, 'Hỗ trợ hành trình', h('strong', null, hotline.label)), h(Icon, { name: 'call' })),
      ),
      h('section', { id: 'lich-su' },
        h('h2', { className: 'vt-r-title' }, 'Lịch sử chuyến đi gần đây'),
        h('div', { className: 'vt-r-list' }, data.history.length ? data.history.map((trip) =>
          h('article', { className: 'vt-r-panel', key: trip.booking_id },
            h('span', { className: 'vt-r-badge' }, statusLabels.get(trip.booking_status)),
            h('small', null, 'Đơn #' + trip.booking_id + ' · ' + formatDate(trip.pickup_time)),
            h('h3', null, trip.pickup_location + ' → ' + trip.dropoff_location),
            Number.isFinite(trip.estimated_price) && h('p', null, 'Giá dự kiến · ', currency.format(trip.estimated_price))))
          : h('p', { className: 'vt-r-panel' }, 'Bạn chưa có chuyến đi trong lịch sử.')),
      ),
    ),
  );
}

export default function RenterDashboardPage() {
  const user = useOutletContext();
  const result = useHomeResource(loadRenterDashboard);

  if (result.error?.response?.status === 401) return h(Navigate, { to: '/login', replace: true });
  return h('div', { className: 'vt-homepage vt-r-dashboard' },
    h('header', { className: 'vt-h-header' }, h('div', { className: 'vt-h-wrap vt-r-nav' },
      h(Link, { to: '/', className: 'vt-h-brand' }, h(Icon, { name: 'directions_car' }), 'VietTour'),
      h('nav', { 'aria-label': 'Điều hướng Người thuê' },
        navigation.map(([label, href]) => h('a', { key: href, href }, label))),
      h('div', { className: 'vt-r-account' }, h('span', null, user.full_name),
        h(SignOutButton)),
    )),
    result.loading ? h('main', { className: 'vt-h-wrap vt-r-message', role: 'status' }, 'Đang tải chuyến đi…')
      : result.error ? h('main', { className: 'vt-h-wrap vt-r-message', role: 'alert' }, 'Chưa thể tải dashboard. Vui lòng tải lại trang.')
        : h(RenterContent, { data: result.data, user }),
    h(LoginFooter),
  );
}
