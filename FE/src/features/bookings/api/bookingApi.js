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

export async function sendBookingQuote(id, route) {
  return (await apiClient.patch(`/operator/bookings/${id}/quote`, route)).data.data;
}

export async function completeBooking(id) {
  return (await apiClient.patch(`/operator/bookings/${id}/complete`, {})).data.data;
}

export function getBookingError(error) {
  if (error.response?.status === 401) {
    return 'Bạn cần đăng nhập bằng tài khoản Operator để duyệt hoặc từ chối booking.';
  }
  return error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
}

export async function previewBookingQuote(id, calculation) {
  return (await apiClient.post(`/operator/bookings/${id}/quote-preview`, { calculation })).data.data;
}
export async function fetchQuoteRates() {
  return (await apiClient.get('/operator/bookings/quote-rates')).data.data;
}
