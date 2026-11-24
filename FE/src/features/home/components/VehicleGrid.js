import { createElement as h, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './HomeIcon.js';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

function VehiclePhoto({ name, src }) {
  const [failed, setFailed] = useState(false);
  return h('figure', null,
    !failed
      ? h('img', { src, alt: name, loading: 'lazy', onError: () => setFailed(true) })
      : h('span', { className: 'vt-h-car-no-photo' }, 'Chưa có ảnh xe'),
  );
}

function photoUrls(value) {
  return Array.isArray(value) ? value.filter((src) => typeof src === 'string' && /^https?:\/\/\S+$/i.test(src)) : [];
}

function VehicleGallery({ vehicle, name }) {
  const actual = new Set(photoUrls(vehicle.photos));
  const urls = [...new Set([...actual, ...photoUrls(vehicle.illustration_photos)])].slice(0, 4);
  if (!urls.length) return h('p', { className: 'vt-h-gallery-label' }, 'Chưa có ảnh xe.');

  return h('div', { className: 'vt-h-gallery' },
    h('div', { className: 'vt-h-vehicle-photos' }, urls.map((src, index) =>
      h(VehiclePhoto, { key: src, src,
        name: name + ' – ảnh ' + (index + 1) + (actual.has(src) ? '' : ' (minh họa)') }))),
    urls.some((src) => !actual.has(src)) && h('p', { className: 'vt-h-gallery-label' },
      urls.some((src) => actual.has(src)) ? 'Bộ ảnh có ảnh minh họa' : 'Ảnh minh họa theo mẫu xe'),
  );
}

export default function VehicleGrid({ vehicles, hotline }) {
  if (!vehicles.length) return h('div', { className: 'vt-h-fleet-empty' },
    h(Icon, { name: 'directions_car' }),
    h('div', null,
      h('h3', null, 'Chưa có xe phù hợp để hiển thị'),
      h('p', null, 'Thử đổi số chỗ, khung giờ hoặc liên hệ VietTour để được hỗ trợ.')),
    h('a', { className: 'vt-h-outline', href: '#tim-xe' }, 'Chỉnh tìm kiếm'),
  );
  return h('div', { className: 'vt-h-vehicle-grid' }, vehicles.map((vehicle) => {
      const name = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
      return h('article', { className: 'vt-h-car', key: vehicle._id },
        h(VehicleGallery, { vehicle, name }),
        h('div', { className: 'vt-h-car-content' },
          h('h3', null, name),
          h('div', { className: 'vt-h-car-specs' },
            h('span', null, h(Icon, { name: 'groups' }), vehicle.seats, ' chỗ'),
            vehicle.vehicle_type && h('span', null, h(Icon, { name: 'directions_car' }), vehicle.vehicle_type),
            vehicle.manufacture_year && h('span', null, h(Icon, { name: 'calendar_month' }), vehicle.manufacture_year),
          ),
          (vehicle.fuel_type || vehicle.transmission) && h('p', null,
            [vehicle.fuel_type, vehicle.transmission].filter(Boolean).join(' · ')),
          h('div', { className: 'vt-h-car-bottom' },
            Number.isFinite(vehicle.dailyPrice) && h('div', null,
              h('strong', null, currency.format(vehicle.dailyPrice)), h('small', null, ' / ngày')),
            vehicle.vehicle_id
              ? h(Link, { className: 'vt-h-button', to: '/vehicles/' + vehicle.vehicle_id }, 'Xem và đặt xe')
              : h('a', { className: 'vt-h-button', href: hotline }, 'Liên hệ đặt xe'),
          ),
        ),
      );
  }));
}
