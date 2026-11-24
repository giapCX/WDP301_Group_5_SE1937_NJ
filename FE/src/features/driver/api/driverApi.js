import api from '../../../api/client';

export async function fetchDriverDashboard(params, signal) {
  const { data } = await api.get('/driver/dashboard', { params, signal });
  return data.data;
}

export async function fetchDriverTrip(id, signal) {
  const { data } = await api.get(`/driver/trips/${id}`, { signal });
  return data.data;
}

export function driverError(error) {
  return error.response?.data?.message || 'Không tải được dữ liệu. Vui lòng thử lại.';
}
