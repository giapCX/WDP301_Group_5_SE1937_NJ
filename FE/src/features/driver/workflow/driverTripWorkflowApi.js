import api from '../../../api/client';

export async function getDriverWorkflow(signal) {
  return (await api.get('/driver/workflow', { signal })).data.data;
}
export async function driverTripAction(id, action, input = {}) {
  return (await api.post(`/driver/workflow/${id}/${action}`, input)).data.data;
}
export function driverHandoverPhotoUrl(bookingId, inspectionId, index) {
  return api.getUri({ url: `/driver/workflow/${bookingId}/handover/${inspectionId}/photos/${index}` });
}
export async function reportTripIncident(id, input) {
  return (await api.post(`/driver/workflow/${id}/incident`, input)).data.data;
}
export function workflowError(error) {
  return error.response?.data?.message || 'Không thực hiện được thao tác. Vui lòng thử lại.';
}
