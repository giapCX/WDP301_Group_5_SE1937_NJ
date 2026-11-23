import apiClient from '../../../api/client';

const BASE_URL = '/operator/booking-change-requests';

export async function fetchChangeRequests(params, signal) {
  const response = await apiClient.get(BASE_URL, { params, signal });
  return response.data.data;
}

export async function fetchChangeRequest(id, signal) {
  const response = await apiClient.get(`${BASE_URL}/${id}`, { signal });
  return response.data.data;
}

export async function approveChangeRequest(id) {
  const response = await apiClient.patch(`${BASE_URL}/${id}/approve`);
  return response.data.data;
}

export async function rejectChangeRequest(id, reason) {
  const response = await apiClient.patch(`${BASE_URL}/${id}/reject`, {
    rejection_reason: reason,
  });
  return response.data.data;
}

export function changeRequestError(error) {
  if (error.response?.status === 401) {
    return 'Bạn cần đăng nhập tài khoản Operator để xử lý yêu cầu đổi lịch.';
  }
  return error.response?.data?.error?.message || error.response?.data?.message || 'Không thể tải dữ liệu. Vui lòng thử lại.';
}
