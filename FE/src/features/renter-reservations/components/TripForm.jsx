import { useRef } from 'react';
import { earliestTripMinute, minuteMs, toTripTime } from '../reservationFormat.js';
import VietnamDateTimeField from './VietnamDateTimeField.jsx';

const MAX_STOPS = 20;

export default function TripForm({ trip, onChange, seatCount, onTimeError }) {
  const nextStopId = useRef(Math.max(0, ...trip.stops.map(({ id }) => id)) + 1);
  const tour = trip.serviceType === 'tour';
  const change = (name, value) => onChange({ ...trip, [name]: value });
  const changeStops = (stops) => change('stops', stops);

  function move(index, offset) {
    const stops = [...trip.stops];
    const target = index + offset;
    [stops[index], stops[target]] = [stops[target], stops[index]];
    changeStops(stops);
  }

  function input(label, name, type = 'text', options = {}) {
    return <label>{label}<input name={name} type={type} required value={trip[name]} onChange={(event) => change(name, event.target.value)} {...options}/></label>;
  }

  function dateTime(label, name, min) {
    return <VietnamDateTimeField label={label} name={name} value={trip[name]} min={min}
      onChange={(value) => change(name, value)} onTimeError={onTimeError}/>;
  }

  return (
    <>
      <p className="rv-muted">Chọn ngày giờ hoặc nhập theo định dạng DD/MM/YYYY HH:mm. Form dùng giờ Việt Nam (UTC+7) và hệ 24 giờ.</p>
      <div className="rv-form-grid">
        {input('Địa điểm đón khách', 'pickup', 'text', { maxLength: 255 })}
        {input(tour ? 'Khu vực du lịch' : 'Địa điểm du lịch', 'destination', 'text', { maxLength: 255 })}
        {dateTime('Ngày giờ khởi hành (giờ VN)', 'pickupTime', earliestTripMinute())}
        {dateTime(tour ? 'Ngày giờ kết thúc (giờ VN)' : 'Ngày giờ đón về (giờ VN)', 'endTime', trip.pickupTime)}
        {!tour && input('Địa điểm đón về', 'returnPickup', 'text', { maxLength: 255 })}
        {!tour && dateTime('Ngày giờ dự kiến trả khách (giờ VN)', 'finalTime', trip.endTime)}
        {input('Địa điểm trả khách cuối cùng', 'dropoff', 'text', { maxLength: 255 })}
        {input('Số hành khách', 'passengerCount', 'number', { min: 1, max: seatCount })}
      </div>
      {tour && (
        <fieldset className="rv-stops">
          <legend>Danh sách điểm tham quan</legend>
          {trip.stops.map((stop, index) => {
            const edit = (name, value) => changeStops(trip.stops.map((item) => item.id === stop.id ? { ...item, [name]: value } : item));
            const previousDeparture = trip.stops[index - 1]?.departure;
            const arrivalMin = previousDeparture > trip.pickupTime ? previousDeparture : trip.pickupTime;
            const departureMin = stop.arrival ? earliestTripMinute(Date.parse(toTripTime(stop.arrival)) + minuteMs) : arrivalMin;

            return (
              <div className="rv-stop" key={stop.id}>
                <div className="rv-stop-heading">
                  <strong>Điểm {index + 1}</strong>
                  <div className="rv-actions">
                    <button type="button" className="rv-button" disabled={index === 0} onClick={() => move(index, -1)}>Lên</button>
                    <button type="button" className="rv-button" disabled={index === trip.stops.length - 1} onClick={() => move(index, 1)}>Xuống</button>
                    <button type="button" className="rv-button" disabled={trip.stops.length === 1} onClick={() => changeStops(trip.stops.filter(({ id }) => id !== stop.id))}>Xóa</button>
                  </div>
                </div>
                <div className="rv-form-grid">
                  <label>Địa điểm<input required maxLength="255" value={stop.location} onChange={(event) => edit('location', event.target.value)}/></label>
                  <VietnamDateTimeField label={`Ngày giờ đến điểm ${index + 1} (giờ VN)`} name={`arrival-${stop.id}`}
                    value={stop.arrival} min={arrivalMin} max={trip.endTime} onChange={(value) => edit('arrival', value)} onTimeError={onTimeError}/>
                  <VietnamDateTimeField label={`Ngày giờ rời điểm ${index + 1} (giờ VN)`} name={`departure-${stop.id}`}
                    value={stop.departure} min={departureMin} max={trip.endTime} onChange={(value) => edit('departure', value)} onTimeError={onTimeError}/>
                </div>
              </div>
            );
          })}
          <button type="button" className="rv-button" disabled={trip.stops.length >= MAX_STOPS}
            onClick={() => changeStops([...trip.stops, { id: nextStopId.current++, location: '', arrival: '', departure: '' }])}>Thêm điểm dừng</button>
        </fieldset>
      )}
      <label>Yêu cầu bổ sung<textarea rows="3" maxLength="1000" value={trip.notes} onChange={(event) => change('notes', event.target.value)}/></label>
    </>
  );
}

