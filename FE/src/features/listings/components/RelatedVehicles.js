import { useEffect, useState } from 'react';
import { getListings } from '../api/listingApi';
import VehicleCard from './VehicleCard';

export default function RelatedVehicles({ listing }) {
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    const params = { limit: 5 };
    if (listing.vehicle?.seats) params.seats = listing.vehicle.seats;
    getListings(params, { signal: controller.signal })
      .then(({ data }) => setVehicles(data.filter(item => item._id !== listing._id).slice(0, 4)))
      .catch(() => {});
    return () => controller.abort();
  }, [listing]);

  if (!vehicles.length) return null;
  return <section className="detail-related">
    <h2>Xe tương tự</h2>
    <div className="vehicle-grid">
      {vehicles.map((vehicle, index) => <VehicleCard key={vehicle._id} listing={vehicle} index={index}
        onDetails={item => { window.location.hash = '#/xe/' + item._id; }} />)}
    </div>
  </section>;
}
