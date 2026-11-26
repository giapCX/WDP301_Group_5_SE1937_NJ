import { createElement as h, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './HomeIcon.js';
import { getPrimaryVehiclePhoto } from '../../shared/vehicle/vehiclePhotos.js';
import { vehiclePhotoContent } from '../homeContent.js';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

function VehiclePhoto({ photo, name, seatCount }) {
  const [usingFallback, setUsingFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const displayedPhoto = usingFallback ? photo?.fallback : photo;

  if (!displayedPhoto || failed) {
    return h('figure', { className: 'vt-h-car-photo vt-h-car-photo--empty' },
      h(Icon, { name: 'directions_car' }),
      h('figcaption', null, vehiclePhotoContent.unavailable));
  }

  function handleImageError() {
    if (!usingFallback && photo.fallback) {
      setUsingFallback(true);
      return;
    }
    setFailed(true);
  }

  return h('figure', { className: 'vt-h-car-photo' },
    h('img', {
      src: displayedPhoto.src,
      alt: displayedPhoto.isReference ? vehiclePhotoContent.referenceAlt(seatCount) : name,
      loading: 'lazy',
      onError: handleImageError,
    }),
    displayedPhoto.isReference && h('figcaption', null, vehiclePhotoContent.referenceNotice));
}

function VehicleGallery({ vehicle, name }) {
  return h('div', { className: 'vt-h-gallery' },
    h(VehiclePhoto, {
      photo: getPrimaryVehiclePhoto(vehicle),
      name,
      seatCount: vehicle.seats ?? vehicle.seat_count,
    }));
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
      const seatCount = vehicle.seats ?? vehicle.seat_count;
      return h('article', { className: 'vt-h-car', key: vehicle._id },
        h(VehicleGallery, { vehicle, name }),
        h('div', { className: 'vt-h-car-content' },
          h('h3', null, name),
          h('div', { className: 'vt-h-car-specs' },
            h('span', null, h(Icon, { name: 'groups' }), seatCount, ' chỗ'),
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