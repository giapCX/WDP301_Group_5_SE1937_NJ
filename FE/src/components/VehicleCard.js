import { useState } from 'react';
import Icon from './Icon';

export const money = (value) => new Intl.NumberFormat('vi-VN').format(value);
export const fuelLabels = { gasoline: 'Xăng', diesel: 'Dầu', electric: 'Điện', hybrid: 'Hybrid' };

export function listingPhoto(listing, index = 0) {
  const source = listing.photos?.[0];
  if (source && (/^https?:\/\//i.test(source) || source.startsWith('/uploads/')))
    return { src: source, illustration: false };
  const examples = [1, 2, 3, 4, 6, 2];
  const stableIndex = Number.parseInt(listing._id?.slice(-2), 16);
  return {
    src: `/images/home/car-${examples[(Number.isFinite(stableIndex) ? stableIndex : index) % examples.length]}.jpg`,
    illustration: true,
  };
}

function savedVehicles() {
  try {
    const value = JSON.parse(localStorage.getItem('xedi-saved-vehicles') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default function VehicleCard({ listing, index, onDetails }) {
  const [saved, setSaved] = useState(() => savedVehicles().includes(listing._id));
  const [imageFailed, setImageFailed] = useState(false);
  const photo = listingPhoto(listing, index);
  const vehicle = listing.vehicle;
  const toggleSaved = () => {
    const next = !saved;
    const values = savedVehicles().filter((id) => id !== listing._id);
    if (next) values.push(listing._id);
    try {
      localStorage.setItem('xedi-saved-vehicles', JSON.stringify(values));
    } catch {
      /* Saving stays optional when browser storage is unavailable. */
    }
    setSaved(next);
  };
  return (
    <article className="vehicle-card">
      <div className="vehicle-image">
        <button
          className="vehicle-image-link"
          aria-label={`Xem ${listing.title}`}
          onClick={() => onDetails(listing)}
        >
          <img
            src={imageFailed ? '/images/home/car-1.jpg' : photo.src}
            onError={() => setImageFailed(true)}
            alt={
              photo.illustration || imageFailed
                ? `Ảnh xe minh họa cho tin ${listing.title}`
                : listing.title
            }
            loading="lazy"
          />
        </button>
        <span className="vehicle-badge">
          <Icon name="shield" size={13} /> Xe đã kiểm duyệt
        </span>
        <button
          className={`favorite-button ${saved ? 'is-saved' : ''}`}
          aria-label={`${saved ? 'Bỏ lưu' : 'Lưu'} ${listing.title}`}
          aria-pressed={saved}
          onClick={toggleSaved}
        >
          <Icon name="heart" size={18} />
        </button>
        {(photo.illustration || imageFailed) && (
          <span className="illustration-label">Ảnh minh họa</span>
        )}
      </div>
      <div className="vehicle-content">
        <div className="vehicle-location">
          <Icon name="pin" size={14} />
          <span>{listing.pickup_location.city}</span>
          <span className="verified-label">
            <Icon name="check" size={12} /> Tại gara
          </span>
        </div>
        <h3>
          <button onClick={() => onDetails(listing)}>
            {vehicle.brand} {vehicle.model} <span>({vehicle.manufacture_year})</span>
          </button>
        </h3>
        <div className="vehicle-tags">
          <span>
            <Icon name="gear" size={12} />
            {vehicle.transmission === 'automatic' ? 'Tự động' : 'Số sàn'}
          </span>
          <span>
            <Icon name={vehicle.fuel_type === 'electric' ? 'bolt' : 'leaf'} size={12} />
            {fuelLabels[vehicle.fuel_type] || vehicle.fuel_type}
          </span>
          <span>
            <Icon name="people" size={12} />
            {vehicle.seats} chỗ
          </span>
        </div>
        <div className="vehicle-bottom">
          <div>
            <small>GIÁ THUÊ TỰ LÁI</small>
            <strong>{money(listing.daily_price)} đ</strong>
            <span className="per-day"> /ngày</span>
          </div>
          <button className="button button-primary button-small" onClick={() => onDetails(listing)}>
            Xem xe <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
