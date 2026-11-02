import Icon from '../ui/Icon';
import VehicleImage from './VehicleImage';
import { formatPrice } from '../../utils/formatPrice';
export default function VehicleCard({ car, saved, onSave, onSelect }) {
  return (
    <article className="vehicle-card">
      <div className="vehicle-photo">
        <VehicleImage car={car} />
        <div className="vehicle-badges">
          {car.badge && (
            <span
              className={`vehicle-badge ${car.superhost ? 'badge-gold' : ''}`}
            >
              <Icon name={car.superhost ? 'shield' : 'bolt'} size={11} />
              {car.badge}
            </span>
          )}
          {car.feature && (
            <span className="vehicle-badge badge-dark">{car.feature}</span>
          )}
        </div>
        <button
          className={`save-button ${saved ? 'is-saved' : ''}`}
          aria-label={`${saved ? 'Bỏ lưu' : 'Lưu'} ${car.name}`}
          aria-pressed={saved}
          onClick={() => onSave(car.id)}
        >
          <Icon name="heart" size={20} />
        </button>
        <span className="fuel-label">
          <Icon name={car.fuel === 'electric' ? 'bolt' : 'car'} size={11} />
          {car.fuelLabel}
        </span>
      </div>
      <div className="vehicle-body">
        <div className="vehicle-meta">
          <span>
            <Icon name="location" size={12} />
            {car.location}
          </span>
          {car.rating && (
            <span className="rating">
              <b>★</b> <strong>{car.rating}</strong> ({car.reviews})
            </span>
          )}
        </div>
        <h2 title={car.name}>{car.name}</h2>
        <div className="vehicle-tags">
          {car.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <div className="vehicle-price">
        <div>
          <span className="eyebrow">GIÁ THUÊ TỰ LÁI</span>
          <strong>
            {formatPrice(car.price)} đ<small> / ngày</small>
          </strong>
        </div>
        <button className="primary-button" onClick={() => onSelect(car)}>
          Chọn xe
        </button>
      </div>
    </article>
  );
}
