import { useEffect, useState } from 'react';
import {
  approveBooking,
  completeBooking,
  fetchAvailableVehicles,
  fetchBooking,
  getBookingError,
  rejectBooking,
  sendBookingQuote,
} from '../api/bookingApi';

export default function useBookingReview(id, onUpdated) {
  const [booking, setBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [vehiclesError, setVehiclesError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setBooking(null);
    setVehicles([]);
    setVehicleId('');
    setVehiclesError('');
    (async () => {
      try {
        const detail = await fetchBooking(id, controller.signal);
        if (controller.signal.aborted) return;
        setBooking(detail);
        if (['pending', 'quoted'].includes(detail.booking_status)) {
          try {
            const available = await fetchAvailableVehicles(id, controller.signal);
            if (controller.signal.aborted) return;
            setVehicles(available);
            if (available.some((vehicle) => vehicle.vehicle_id === detail.vehicle_id)) {
              setVehicleId(String(detail.vehicle_id));
            }
          } catch (failure) {
            if (!controller.signal.aborted) setVehiclesError(getBookingError(failure));
          }
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(getBookingError(failure));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [id, revision]);

  async function decide(action, payload) {
    if (saving) return false;
    setSaving(true);
    setError('');
    try {
      if (action === 'approve') await approveBooking(id, booking?.requested_seats ? undefined : Number(vehicleId));
      else if (action === 'quote') await sendBookingQuote(id, payload);
      else if (action === 'complete') await completeBooking(id);
      else await rejectBooking(id, payload.trim());
      onUpdated();
      return true;
    } catch (failure) {
      setError(getBookingError(failure));
      if (failure.response?.status === 409 && !booking?.requested_seats) {
        setVehicles([]);
        setVehicleId('');
        setVehiclesError('Dữ liệu đã thay đổi. Vui lòng tải lại trước khi duyệt.');
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    booking,
    vehicles,
    vehicleId,
    setVehicleId,
    loading,
    saving,
    error,
    vehiclesError,
    decide,
    reload: () => setRevision((value) => value + 1),
  };
}
