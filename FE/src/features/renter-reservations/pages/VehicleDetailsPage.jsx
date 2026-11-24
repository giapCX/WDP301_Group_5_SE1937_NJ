import { Link, useLocation, useParams } from 'react-router-dom';
import useHomeResource from '../../home/hooks/useHomeResource.js';
import { loadVehicle } from '../api/reservationsApi.js';
import ReservationLayout from '../components/ReservationLayout.jsx';
import VehicleSummary from '../components/VehicleSummary.jsx';
import { errorMessage } from '../reservationFormat.js';

export default function VehicleDetailsPage() {
  const { state } = useLocation();
  const { vehicleId } = useParams();
  const vehicle = useHomeResource(loadVehicle, vehicleId);

  return (
    <ReservationLayout publicPage>
      <div className="rv-heading rv-heading-actions">
        <h1>Chi tiết xe</h1>
        <Link className="rv-button" to={{ pathname: '/vehicles', search: state?.catalogSearch }}>Danh sách xe</Link>
      </div>
      {vehicle.loading && <p role="status">Đang tải thông tin xe…</p>}
      {vehicle.error && <p role="alert" className="rv-error">{errorMessage(vehicle.error, 'Chưa thể tải thông tin xe.')}</p>}
      {vehicle.data && (
        <article className="rv-panel rv-vehicle-card rv-vehicle-details">
          <VehicleSummary key={vehicleId} vehicle={vehicle.data}/>
          <Link className="rv-button rv-primary" to="/renter/bookings/new" state={state}>Đặt chuyến đi</Link>
        </article>
      )}
    </ReservationLayout>
  );
}

