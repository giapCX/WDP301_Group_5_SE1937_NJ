import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import TripForm from '../../renter-reservations/components/TripForm';
import { loadQuoteReview } from '../../renter-reservations/api/reservationsApi';
import { operationAction, operationError } from '../api/operationsApi';
import { Feedback } from './OperationShared';
const local = (value) => value ? new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16) : '';
const iso = (value) => value ? value + ':00+07:00' : undefined;
export default function RenterChangeForm({ booking, onDone }) {
  const [trip, setTrip] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  useEffect(() => {
    if (!trip) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button')?.focus();
    function keys(event) {
      if (event.key === 'Escape' && !busy) setTrip(null);
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled):not([readonly]),select:not(:disabled),textarea:not(:disabled)')];
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('keydown', keys); document.body.style.overflow = overflow; previous?.focus(); };
  }, [Boolean(trip), busy]);
  async function open() {
    setBusy(true); setError('');
    try {
      const detail = await loadQuoteReview(booking.booking_id);
      setTrip({ serviceType: booking.service_type || 'tour', requestedSeats: booking.requested_seats || booking.requested_seat_count || booking.vehicle?.seat_count,
        pickup: booking.pickup_location, destination: booking.destination || '', dropoff: booking.dropoff_location,
        returnPickup: booking.return_pickup_location || '', notes: booking.special_requests || '', passengerCount: booking.passenger_count || 1,
        pickupTime: local(booking.pickup_time), endTime: local(booking.service_type === 'roundtrip' ? booking.return_pickup_time : booking.estimated_end_time),
        finalTime: local(booking.estimated_end_time), stops: detail.stops.map((stop) => ({ id: stop.stop_id, location: stop.location, arrival: local(stop.arrival_at), departure: local(stop.departure_at) })) });
    } catch (failure) { setError(operationError(failure)); } finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const fields = new FormData(event.currentTarget);
    const roundtrip = trip.serviceType === 'roundtrip';
    const after = { pickup_location: trip.pickup, dropoff_location: trip.dropoff, pickup_time: iso(fields.get('pickupTime')),
      estimated_end_time: iso(fields.get(roundtrip ? 'finalTime' : 'endTime')),
      trip_stops: roundtrip ? [{ stop_order: 1, location: trip.destination }, { stop_order: 2, location: trip.returnPickup, departure_at: iso(fields.get('endTime')) }] : trip.stops.map((stop, index) => ({ stop_order: index + 1, location: stop.location, arrival_at: iso(fields.get('arrival-' + stop.id)), departure_at: iso(fields.get('departure-' + stop.id)) })),
    };
    if (booking.service_type) after.destination = trip.destination;
    if (roundtrip) { after.return_pickup_location = trip.returnPickup; after.return_pickup_time = iso(fields.get('endTime')); }
    try { await operationAction(`/renter/bookings/${booking.booking_id}/change-requests`, { after, reason: fields.get('reason') }); setTrip(null); onDone(); }
    catch (failure) { setError(operationError(failure)); } finally { setBusy(false); }
  }
  return <section><Feedback error={!trip ? error : ''}/><button type="button" className="dispatch-button primary" disabled={busy} onClick={open}>{busy && !trip ? 'Đang tải lịch trình…' : 'Yêu cầu đổi lịch trình'}</button>
    {trip && createPortal(<div className="rv-change-backdrop"><div className="rv-change-dialog rv-app" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="renter-change-title">
      <header className="rv-change-header"><div><span>ĐƠN #{booking.booking_id} · THAY ĐỔI LỊCH TRÌNH</span><h2 id="renter-change-title">Đề xuất lịch trình mới</h2></div><button type="button" className="rv-button" disabled={busy} onClick={()=>setTrip(null)}>Đóng</button></header>
      <form className="op-form rv-change-form" onSubmit={submit}>
        <div className="rv-change-body"><p className="rv-notice">Số hành khách, loại dịch vụ và yêu cầu xe giữ theo đơn đã xác nhận. Operator sẽ xem xét lịch trình và báo lại nếu giá thay đổi.</p>
          <fieldset disabled={busy}><TripForm lockPickup={booking.booking_status === 'in_progress'} readOnlyDetails trip={trip} onChange={setTrip} seatCount={trip.requestedSeats} onTimeError={setError}/><label>Lý do thay đổi<textarea className="rv-change-reason" name="reason" required maxLength={2000} placeholder="Cho chúng tôi biết bạn muốn thay đổi điều gì…"/></label></fieldset><Feedback error={error}/>
        </div>
        <footer className="rv-change-footer"><button type="button" className="rv-button" disabled={busy} onClick={()=>setTrip(null)}>Hủy chỉnh sửa</button><button type="submit" className="rv-button rv-primary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đề xuất'}</button></footer>
      </form>
    </div></div>,document.body)}
  </section>;
}
