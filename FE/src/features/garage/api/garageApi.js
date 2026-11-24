import api from '../../../api/client';

export async function getGarageTasks(date, signal) {
  return (await api.get('/garage/tasks', { params: { date }, signal })).data.data;
}
export async function submitGarageInspection(input) {
  return (await api.post('/garage/inspections', input)).data.data;
}
export async function updateGarageMaintenance(id, status) {
  return (await api.patch(`/garage/maintenance/${id}`, { status })).data.data;
}
export function garageError(error) {
  return error.response?.data?.message || 'Không thể cập nhật nhiệm vụ gara.';
}
