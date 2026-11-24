import api from '../../../api/client';
export async function fetchMonitoredTrips(params, signal) {
  const { data } = await api.get('/operator/trips', { params, signal });
  return data.data;
}
export async function fetchMonitoredTrip(id, signal) {
  const { data } = await api.get(`/operator/trips/${id}`, { signal });
  return data.data;
}
