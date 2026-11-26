import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import useHomeResource from '../../home/hooks/useHomeResource.js';
import { createReservation, loadSeatOptions } from '../api/reservationsApi.js';
import ReservationLayout from '../components/ReservationLayout.jsx';
import TripForm from '../components/TripForm.jsx';
import { errorMessage, services, toTripTime } from '../reservationFormat.js';

const steps = ['Chọn dịch vụ', 'Lộ trình và thời gian', 'Chờ xem xét'];

function tripPayload(trip) {
  return {
    ...trip, requestedSeats: Number(trip.requestedSeats), passengerCount: Number(trip.passengerCount),
    pickupTime: toTripTime(trip.pickupTime), endTime: toTripTime(trip.endTime), finalTime: toTripTime(trip.finalTime),
    stops: trip.stops.map(({ location, arrival, departure }) => ({ location, arrival: toTripTime(arrival), departure: toTripTime(departure) })),
  };
}

function Planner({ seatOptions, state }) {
  const [step, setStep] = useState(0);
  const [trip, setTrip] = useState({
    serviceType: state?.serviceType === 'tour' ? 'tour' : 'roundtrip',
    requestedSeats: state?.requestedSeats > 0 ? seatOptions.find((seats) => seats >= state.requestedSeats) ?? '' : '',
    pickup: '', destination: '', dropoff: '', returnPickup: '', notes: '', passengerCount: 1,
    pickupTime: state?.startAt?.slice(0, 16) ?? '', endTime: state?.endAt?.slice(0, 16) ?? '',
    finalTime: '', stops: [{ id: 1, location: '', arrival: '', departure: '' }],
  });
  const [requestId, setRequestId] = useState(null);
  const [requestedBooking, setRequestedBooking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function updateTrip(value) {
    setTrip(value);
    setError('');
  }

  async function submitTrip(event) {
    event.preventDefault();
      const fields = new FormData(event.currentTarget);
    const itinerary = {
      ...trip,
      pickupTime: fields.get('pickupTime'),
      endTime: fields.get('endTime'),
      finalTime: fields.get('finalTime') || '',
      stops: trip.serviceType === 'tour' ? trip.stops.map((stop) => ({
        ...stop,
        arrival: fields.get('arrival-' + stop.id),
        departure: fields.get('departure-' + stop.id),
      })) : trip.stops,
    };
    const id = requestId ?? crypto.randomUUID();
    setRequestId(id);
    setBusy(true);
    setError('');
    try {
      const booking = await createReservation({
        ...tripPayload(itinerary),
        requestId: id,
      });
      setRequestedBooking(booking.bookingId);
      setStep(2);
    } catch (failure) {
      setError(errorMessage(failure, 'Chưa thể gửi yêu cầu đặt xe.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ol className="rv-steps">{steps.map((label, index) => (
        <li key={label} data-complete={index < step} aria-current={index === step ? 'step' : undefined}><span>{index + 1}</span>{label}</li>
      ))}</ol>
      <div className="rv-columns">
        <section className="rv-panel rv-stage" aria-labelledby="planner-step">
          <h2 id="planner-step">{steps[step]}</h2>
          {error && <p className="rv-error" role="alert">{error}</p>}
          {step === 0 && <form onSubmit={(event) => { event.preventDefault(); setStep(1); }}>
            <div className="rv-service-options">
              {services.map((service) => (
                <label key={service.value} data-selected={service.value === trip.serviceType}>
                  <input type="radio" name="service" checked={service.value === trip.serviceType}
                    onChange={() => updateTrip({ ...trip, serviceType: service.value })}/>
                  <span><strong>{service.label}</strong><small>{service.description}</small></span>
                </label>
              ))}
            </div>
            <label>Số chỗ xe tối thiểu
              <select required value={trip.requestedSeats} onChange={(event) => updateTrip({ ...trip, requestedSeats: Number(event.target.value) || '' })}>
                <option value="">Chọn số chỗ</option>
                {seatOptions.map((seats) => <option key={seats} value={seats}>{seats} chỗ</option>)}
              </select>
            </label>
            <button className="rv-button rv-primary" type="submit">Tiếp tục</button>
          </form>}
          {step === 2 && <div className="rv-quote-acceptance">
            <p className="rv-success" role="status">Đã gửi yêu cầu #{requestedBooking}. Đang chờ Operator kiểm tra và gửi báo giá.</p>
            <Link className="rv-button rv-primary" to={'/renter/bookings?booking=' + requestedBooking}>
              Theo dõi trong My Bookings
            </Link>
          </div>}
          {step === 1 && <form onSubmit={submitTrip}>
            <TripForm trip={trip} onChange={updateTrip} seatCount={trip.requestedSeats} onTimeError={setError}/>
            <p>Operator sẽ xem xét lịch trình và gửi báo giá trong My Bookings. Bạn chưa cần thanh toán ở bước này.</p>
            <div className="rv-actions">
              <button className="rv-button" type="button" disabled={busy} onClick={() => setStep(0)}>Quay lại</button>
              <button className="rv-button rv-primary" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu báo giá'}</button>
            </div>
          </form>}
        </section>
        <aside className="rv-panel rv-summary" aria-label="Số chỗ và báo giá">
          <h2>Yêu cầu phương tiện</h2>
          {trip.requestedSeats && <strong>Xe từ {trip.requestedSeats} chỗ</strong>}
          <p>VietTour sẽ phân xe phù hợp khi duyệt yêu cầu.</p>
        </aside>
      </div>
    </>
  );
}

export default function TripPlannerPage() {
  const { state } = useLocation();
  const [params] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const options = useHomeResource(loadSeatOptions, revision);
  const serviceType = params.get('service') ?? state?.serviceType;
  const requestedSeats = Number(params.get('minSeats'));

  return (
    <ReservationLayout>
      <div className="rv-heading"><h1>Đặt xe và tùy chỉnh lộ trình</h1><p>Giờ lịch trình được nhập theo giờ Việt Nam.</p></div>
      {options.loading && <p role="status">Đang tải số chỗ có thể đặt…</p>}
      {options.error && <p role="alert" className="rv-error">
        {errorMessage(options.error, 'Chưa thể tải số chỗ.')} <button className="rv-button" type="button" onClick={() => setRevision((value) => value + 1)}>Thử lại</button>
      </p>}
      {options.data?.length === 0 && <p className="rv-panel">Chưa có xe có thể đặt.</p>}
      {options.data?.length > 0 && <Planner key={params.toString()} seatOptions={options.data} state={{ ...state, serviceType, requestedSeats }}/>}
    </ReservationLayout>
  );
}

