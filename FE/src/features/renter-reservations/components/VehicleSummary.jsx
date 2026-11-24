import { useState } from 'react';
import { money, vehicleName } from '../reservationFormat.js';

export default function VehicleSummary({ vehicle }) {
  const [failed, setFailed] = useState(false);
  const name = vehicleName(vehicle);
  const photo = [vehicle.photos, vehicle.illustration_photos].flat()
    .find((value) => typeof value === 'string' && /^https?:\/\//i.test(value));

  return (
    <div className="rv-vehicle">
      {photo && !failed
        ? <img src={photo} alt={name} loading="lazy" onError={() => setFailed(true)}/>
        : <div className="rv-no-photo">Chưa có ảnh xe</div>}
      <div className="rv-vehicle-info">
        <h2>{name}</h2>
        <p>{[vehicle.vehicle_type, (vehicle.seats ?? vehicle.seat_count) + ' chỗ', vehicle.manufacture_year, vehicle.fuel_type].filter(Boolean).join(' · ')}</p>
        {vehicle.description && <p>{vehicle.description}</p>}
        {Number.isFinite(vehicle.dailyPrice) && <strong>{money(vehicle.dailyPrice)} <small>/ ngày</small></strong>}
      </div>
    </div>
  );
}

