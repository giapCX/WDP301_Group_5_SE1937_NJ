import { createElement as h, useEffect, useState } from 'react';
import Icon from '../../../components/Icon';
import { clearSession, getSessionToken } from '../../auth/session';
import { getRenter, statusName, vnd } from '../api/renterApi';
import '../styles/viettour-dashboard.css';

const tripIllustration = 'https://lh3.googleusercontent.com/aida-public/AB6AXuB3tLfyONdkgXuRbTaBAtvoRSzeJzhj6i21KxHi2pyY4vgpsZ5Otm_kHgbJsW3OKczzHiuQD4PKattX8_HZALSDzKxzXrKmacV26ZWTUUikn7MjrabJ3viMmfekvv7arwCUanyJPT6ptjEr2u9r2lJ4ATC2AjMVYwq2TBWN18ctgL7ULjlCMjhb9DRLHR78hn6i4YR_wLoM-JJ4tYjL9SqxHdeNQ3LQiKzReu7-N3o';

const metrics = [
  ['bookings', 'Tổng chuyến đã đặt', 'document'],
  ['completed', 'Chuyến đã hoàn thành', 'check'],
  ['upcoming', 'Chuyến đi sắp tới', 'calendar'],
  ['discounted', 'Chuyến có ưu đãi', 'wallet'],
];

const shortcuts = [
  ['Đưa đón sân bay', 'roundtrip', 'pin', 'Chọn sân bay, điểm đón và giờ khởi hành.'],
  ['Thuê xe tour theo ngày', 'tour', 'calendar', 'Chọn thời lượng và các điểm tham quan trong ngày.'],
  ['Limousine doanh nhân', 'roundtrip&vehicle=limo9', 'car', 'Tra cứu xe theo hạng Limousine cho chuyến đi của bạn.'],
  ['Lộ trình tự thiết kế', 'tour', 'document', 'Nhập lộ trình với các điểm dừng theo kế hoạch riêng.'],
];

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
});

function dateLabel(value) {
  const date = value && new Date(value);
  return date && Number.isFinite(date.getTime()) ? dateFormat.format(date) : '';
}

function locationLabel(location) {
  if (typeof location === 'string') return location;
  return location?.addressLabel || location?.branch || location?.city || '';
}

function tripTitle(trip) {
  return [trip.vehicle?.brand, trip.vehicle?.model].filter(Boolean).join(' ') || 'Chuyến đi ' + trip.booking_code;
}

function routeStops(trip) {
  if (trip.stops?.length) return trip.stops;
  return [trip.pickup_location, trip.destination, trip.dropoff_location]
    .map(locationLabel).filter(Boolean)
    .map((location) => ({ location }));
}

function UpcomingTrip({ trip }) {
  const stops = trip ? routeStops(trip) : [];
  return h('section', { id: 'chuyen-sap-toi' },
    h('div', { className: 'vt-dashboard-section-heading' },
      h('h2', null, 'Chuyến Đi Sắp Khởi Hành'),
      trip && h('span', { className: 'vt-dashboard-pill' }, statusName(trip.status)),
    ),
    h('article', { className: 'vt-dashboard-trip' },
      h('div', { className: 'vt-dashboard-trip-summary' },
        trip && h('span', { className: 'vt-dashboard-trip-code' }, 'Mã: ', trip.booking_code),
        h('figure', { className: 'vt-dashboard-trip-photo' },
          h('img', { src: tripIllustration, alt: '', loading: 'lazy' }),
          h('figcaption', null, 'Ảnh minh họa'),
        ),
        trip && h('h3', null, tripTitle(trip)),
      ),
      h('div', { className: 'vt-dashboard-itinerary', id: 'lo-trinh' },
        h('h3', null, 'Lộ trình chuyến đi'),
        trip ? h('div', { className: 'vt-dashboard-itinerary-content' },
          h('p', null, 'Khởi hành ', dateLabel(trip.start_at)),
          stops.length > 0 && h('ol', { className: 'vt-dashboard-timeline' }, stops.map((stop, index) =>
            h('li', { key: stop._id ?? index },
              h('strong', null, stop.location),
              stop.planned_arrival_at && h('small', null, dateLabel(stop.planned_arrival_at)),
            ),
          )),
        ) : h('div', { className: 'vt-dashboard-empty' },
          h('p', null, 'Bạn chưa có chuyến đi sắp tới.'),
          h('a', { className: 'vt-dashboard-button', href: '/#/renter/dat-chuyen' }, 'Đặt chuyến mới'),
        ),
        trip && h('div', { className: 'vt-dashboard-trip-actions' },
          h('button', { type: 'button', className: 'vt-dashboard-button', onClick: () => scrollToPanel('lo-trinh') }, 'Xem lộ trình'),
          h('a', { className: 'vt-dashboard-secondary-button', href: 'tel:19006886' }, 'Yêu cầu đổi giờ đón'),
        ),
        h('a', { className: 'vt-dashboard-inline-link', href: 'tel:19006886' }, 'Liên hệ điều phối VietTour'),
      ),
    ),
  );
}

function RecentOffers({ offers }) {
  return h('section', { id: 'uu-dai' },
    h('div', { className: 'vt-dashboard-section-heading' }, h('h2', null, 'Ưu đãi của bạn'),
      h('span', { className: 'vt-dashboard-section-note' }, offers.length, ' ưu đãi gần đây')),
    h('div', { className: 'vt-dashboard-panel' },
      offers.length ? h('ul', { className: 'vt-dashboard-offers' }, offers.map((offer) =>
        h('li', { key: offer._id },
          h(Icon, { name: 'wallet' }),
          h('div', null,
            h('h3', null, offer.code || 'Ưu đãi đã áp dụng'),
            h('p', null, [offer.booking_code, dateLabel(offer.applied_at)].filter(Boolean).join(' · ')),
          ),
          Number.isFinite(offer.amount) && h('strong', null, vnd(offer.amount)),
        ),
      )) : h('p', { className: 'vt-dashboard-empty' }, 'Chưa có ưu đãi đã áp dụng cho chuyến đi.'),
    ),
    h('aside', { className: 'vt-dashboard-concierge' },
      h('div', null, h('span', null, 'Hỗ trợ khách hàng'), h('h3', null, '1900 6886')),
      h('a', { className: 'vt-dashboard-button', href: 'tel:19006886' }, 'Gọi hỗ trợ'),
    ),
  );
}

function RecentTrips({ trips }) {
  return h('section', { id: 'lich-su' },
    h('div', { className: 'vt-dashboard-section-heading' }, h('h2', null, 'Lịch sử chuyến đi gần đây')),
    h('div', { className: 'vt-dashboard-panel' }, trips.length ? h('ul', { className: 'vt-dashboard-history' },
      trips.map((trip) => h('li', { key: trip._id },
        h('div', null,
          h('p', null, [trip.booking_code, dateLabel(trip.start_at)].filter(Boolean).join(' · ')),
          h('h3', null, [locationLabel(trip.pickup_location), locationLabel(trip.destination)].filter(Boolean).join(' ⇄ ') || tripTitle(trip)),
          (trip.vehicle?.brand || trip.vehicle?.model) && h('p', null, tripTitle(trip)),
        ),
        h('div', null,
          h('span', { className: 'vt-dashboard-pill' }, statusName(trip.status)),
          Number.isFinite(trip.total_price ?? trip.rental_fee_amount) &&
            h('strong', null, vnd(trip.total_price ?? trip.rental_fee_amount)),
        ),
        h('div', { className: 'vt-dashboard-history-actions' },
          h('a', { className: 'vt-dashboard-secondary-button', href: '/#/renter/dat-chuyen?service=' +
            (trip.service_type === 'accompanied_sightseeing' ? 'tour' : 'roundtrip') }, 'Tìm xe cho chuyến tương tự'),
        ),
      )),
    ) : h('p', { className: 'vt-dashboard-empty' }, 'Chưa có chuyến đi trong tài khoản.')),
    h('aside', { className: 'vt-dashboard-insurance' },
      h(Icon, { name: 'shield', size: 24 }),
      h('div', null, h('h3', null, 'Bảo hiểm hành khách'),
        h('p', null, 'Liên hệ VietTour để xác nhận quyền lợi bảo hiểm của chuyến đi.')),
    ),
  );
}

function DashboardFooter() {
  return h('footer', { className: 'vt-dashboard-footer' },
    h('div', { className: 'vt-dashboard-footer-grid' },
      h('div', null, h('a', { className: 'vt-dashboard-brand', href: '/' },
        h('span', { className: 'vt-dashboard-brand-mark' }, h(Icon, { name: 'car' })), 'VietTour'),
        h('p', null, 'Đặt xe du lịch và quản lý hành trình trong tài khoản VietTour.')),
      h('div', null, h('h3', null, 'Dịch vụ cốt lõi'),
        h('a', { href: '/#/renter/dat-chuyen?service=roundtrip' }, 'Đưa đón khứ hồi'),
        h('a', { href: '/#/renter/dat-chuyen?service=tour' }, 'Thuê xe theo tour'),
        h('a', { href: '/#danh-sach-xe' }, 'Danh sách xe')),
      h('div', null, h('h3', null, 'Thông tin hành trình'),
        h('button', { type: 'button', onClick: () => scrollToPanel('chuyen-sap-toi') }, 'Chuyến đi sắp tới'),
        h('button', { type: 'button', onClick: () => scrollToPanel('lich-su') }, 'Lịch sử chuyến đi'),
        h('button', { type: 'button', onClick: () => scrollToPanel('uu-dai') }, 'Ưu đãi đã áp dụng')),
      h('div', null, h('h3', null, 'Liên hệ & tổng đài'),
        h('a', { href: 'tel:19006886' }, 'Hotline 1900 6886')),
    ),
    h('p', { className: 'vt-dashboard-footer-bottom' }, '© VietTour Mobility'),
  );
}

function scrollToPanel(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export default function VietTourRenterDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (!getSessionToken()) {
      setDashboard(null);
      setFailure({ status: 401 });
      return () => controller.abort();
    }
    function loadDashboard() {
      setDashboard(null);
      setFailure(null);
      getRenter('/dashboard', { signal: controller.signal })
        .then(({ data }) => { if (!controller.signal.aborted) setDashboard(data); })
        .catch((error) => { if (!controller.signal.aborted) setFailure(error); });
    }
    function refreshSession() {
      controller.abort();
      setDashboard(null);
      setAttempt((value) => value + 1);
    }
    loadDashboard();
    window.addEventListener('xedi:session', refreshSession);
    window.addEventListener('storage', refreshSession);
    return () => {
      controller.abort();
      window.removeEventListener('xedi:session', refreshSession);
      window.removeEventListener('storage', refreshSession);
    };
  }, [attempt]);

  if (!dashboard) {
    const denied = [401, 403].includes(failure?.status);
    return h('main', { className: 'vt-dashboard vt-dashboard-access' },
      h('h1', null, 'Không gian người thuê VietTour'),
      h('p', { role: failure ? 'alert' : 'status' }, failure
        ? denied ? 'Đăng nhập bằng tài khoản người thuê để xem chuyến đi của bạn.' : failure.message
        : 'Đang tải thông tin chuyến đi…'),
      failure && (denied
        ? h('a', { className: 'vt-dashboard-button', href: '/login' }, 'Đăng nhập người thuê')
        : h('button', { className: 'vt-dashboard-button', type: 'button', onClick: () => setAttempt(attempt + 1) }, 'Thử lại')),
    );
  }

  const { bookings, completed } = dashboard.metrics;
  const initials = dashboard.name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();

  return h('div', { className: 'vt-dashboard' },
    h('header', { className: 'vt-dashboard-header' },
      h('a', { className: 'vt-dashboard-brand', href: '/' },
        h('span', { className: 'vt-dashboard-brand-mark' }, h(Icon, { name: 'car' })),
        h('span', null, 'VietTour', h('small', null, 'Mobility Platform')),
      ),
      h('nav', { 'aria-label': 'Không gian người thuê' },
        h('button', { type: 'button', onClick: () => scrollToPanel('chuyen-sap-toi') }, 'Chuyến đi sắp tới'),
        h('button', { type: 'button', onClick: () => scrollToPanel('lich-su') }, 'Lịch sử chuyến đi'),
        h('button', { type: 'button', onClick: () => scrollToPanel('uu-dai') }, 'Ưu đãi'),
      ),
      h('div', { className: 'vt-dashboard-account' },
        h('span', { className: 'vt-dashboard-account-name' }, dashboard.name, h('small', null, 'Người thuê')),
        h('span', { className: 'vt-dashboard-avatar', 'aria-hidden': true }, initials),
        h('button', { type: 'button', onClick: () => { clearSession(); window.location.href = '/login'; } }, 'Đăng xuất'),
      ),
    ),
    h('main', { className: 'vt-dashboard-content' },
      h('section', { className: 'vt-dashboard-hero' },
        h('div', null,
          h('span', { className: 'vt-dashboard-member' }, h(Icon, { name: 'shield', size: 16 }), 'Thành viên VietTour'),
          h('h1', null, 'Xin chào, ', dashboard.name),
          h('p', null, 'Theo dõi lịch đặt xe và các chuyến đi của bạn.'),
          bookings > 0 && h('div', { className: 'vt-dashboard-progress' },
            h('progress', { value: completed, max: bookings, 'aria-label': 'Chuyến đã hoàn thành' }),
            h('small', null, completed, ' / ', bookings, ' chuyến đã hoàn thành'),
          ),
        ),
        h('a', { className: 'vt-dashboard-button', href: '/#/renter/dat-chuyen' }, 'Đặt chuyến mới'),
      ),
      h('div', { className: 'vt-dashboard-metrics' },
        metrics.map(([key, label, icon]) => h('article', { key },
          h('div', null, h('span', null, label), h('strong', null, dashboard.metrics[key])),
          h('span', { className: 'vt-dashboard-metric-icon' }, h(Icon, { name: icon })),
        )),
      ),
      h(UpcomingTrip, { trip: dashboard.upcomingTrip }),
      h('section', null,
        h('div', { className: 'vt-dashboard-section-heading' }, h('h2', null, 'Phím Tắt Đặt Chuyến Nhanh')),
        h('div', { className: 'vt-dashboard-shortcuts' },
          shortcuts.map(([label, service, icon, description]) => h('a', { key: label, href: '/#/renter/dat-chuyen?service=' + service },
            h('span', { className: 'vt-dashboard-metric-icon' }, h(Icon, { name: icon })),
            h('strong', null, label),
            h('p', null, description),
            h('span', { className: 'vt-dashboard-shortcut-link' }, 'Xem xe', h(Icon, { name: 'arrow', size: 16 })),
          )),
        ),
      ),
      h('div', { className: 'vt-dashboard-columns' },
        h(RecentOffers, { offers: dashboard.recentOffers || [] }),
        h(RecentTrips, { trips: dashboard.recentTrips }),
      ),
    ),
    h(DashboardFooter),
  );
}
