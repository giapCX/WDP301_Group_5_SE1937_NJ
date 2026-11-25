import api from '../../../../api/client';

export async function getDispatchData(signal) {
  return (await api.get('/operator/dispatch', { signal })).data.data;
}
export async function assignTrip(id, input) {
  return (await api.post(`/operator/dispatch/${id}/assign`, input)).data.data;
}
export async function replaceTripVehicle(id, vehicle_id) {
  return (await api.post(`/operator/dispatch/${id}/replace-vehicle`, { vehicle_id })).data.data;
}
export async function reassignReturnDriver(id, driver_id) {
  return (await api.post(`/operator/dispatch/${id}/reassign-return`, { driver_id })).data.data;
}
export async function resolveTripIncident(id, incidentId, resolution_note) {
  return (await api.post(`/operator/dispatch/${id}/incidents/${incidentId}/resolve`, { resolution_note })).data.data;
}
export function operatorDamagePhotoUrl(bookingId, incidentId, index) {
  return api.getUri({ url: `/operator/dispatch/${bookingId}/incidents/${incidentId}/damage-photos/${index}` });
}
export function workflowError(error) {
  return error.response?.data?.message || 'Không thực hiện được thao tác. Vui lòng thử lại.';
}
