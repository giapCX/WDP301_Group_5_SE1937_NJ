import { useState } from 'react';
import Icon from '../ui/Icon';

export default function VehicleImage({
  car,
  className = '',
  loading = 'lazy',
}) {
  const [failedSource, setFailedSource] = useState(null);
  return !car.image || failedSource === car.image ? (
    <div
      className={`image-placeholder ${className}`}
      role="img"
      aria-label={`Ảnh ${car.name} chưa tải được`}
    >
      <Icon name="car" size={64} />
      <span>XeDi · {car.name.split(' (')[0]}</span>
    </div>
  ) : (
    <img
      className={className}
      src={car.image}
      alt={car.name}
      loading={loading}
      onError={() => setFailedSource(car.image)}
    />
  );
}
