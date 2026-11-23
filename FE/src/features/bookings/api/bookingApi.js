import apiClient from '../../../api/client';

export async function fetchBookings(params, signal) {
  const response = await apiClient.get('/operator/bookings', { params, signal });
  return response.data.data;
}

export async function fetchBooking(id, signal) {
  const response = await apiClient.get(`/operator/bookings/${id}`, { signal });
  return response.data.data;
}

export async function fetchAvailableVehicles(id, signal) {
  const response = await apiClient.get(`/operator/bookings/${id}/available-vehicles`, {
    signal,
  });
  return response.data.data.vehicles;
}

export async function approveBooking(id, vehicleId) {
  const response = await apiClient.patch(`/operator/bookings/${id}/approve`, {
    vehicle_id: vehicleId,
  });
  return response.data.data;
}

export async function rejectBooking(id, reason) {
  const response = await apiClient.patch(`/operator/bookings/${id}/reject`, {
    rejection_reason: reason,
  });
  return response.data.data;
}

export function getBookingError(error) {
  if (error.response?.status === 401) {
    return 'Bạn cần đăng nhập bằng tài khoản Operator để duyệt hoặc từ chối booking.';
  }
  return error.response?.data?.error?.message || error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
}
