import apiClient from '../../../api/client';

export async function fetchManagerDashboard(params, signal) {
  const response = await apiClient.get('/manager/dashboard', { params, signal });
  return response.data;
}

export function managerDashboardError(error) {
  if (error.response?.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.response?.status === 403) return 'Tài khoản hiện tại không có quyền Manager.';
  return error.response?.data?.message || 'Không thể tải dữ liệu vận hành. Vui lòng thử lại.';
}
