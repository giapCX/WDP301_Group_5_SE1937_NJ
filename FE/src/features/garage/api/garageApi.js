import api from '../../../api/client';

export async function getGarageTasks(date, signal) {
  return (await api.get('/garage/tasks', { params: date ? { date } : {}, signal })).data.data;
}
export async function getGarageTask(taskId, vehicleId, signal) {
  return (await api.get(`/garage/tasks/${taskId}/${vehicleId}`, { signal })).data.data;
}
export async function createDamageReport(input) {
  return (await api.post('/garage/damages', input)).data.data;
}
export function damagePhotoUrl(inspectionId, index) {
  return api.getUri({ url: `/garage/damages/${inspectionId}/photos/${index}` });
}
export async function createVehicleHandover(input) {
  return (await api.post('/garage/handovers', input)).data.data;
}
export async function recheckVehicleHandover(inspectionId) {
  return (await api.post(`/garage/handovers/${inspectionId}/recheck`)).data.data;
}
export async function submitGarageInspection(input) {
  return (await api.post('/garage/inspections', input)).data.data;
}
export function inspectionPhotoUrl(id, index) {
  return api.getUri({ url: '/garage/inspections/' + id + '/photos/' + index });
}
export async function updateGarageMaintenance(id, status) {
  return (await api.patch(`/garage/maintenance/${id}`, { status })).data.data;
}
export function garageError(error) {
  return error.response?.data?.message || 'Không thể cập nhật nhiệm vụ gara.';
}
