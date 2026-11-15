export function saveErrorMessage(error) {
  if (error?.status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại và kiểm tra thao tác vừa thực hiện.';
  if (error?.status === 403) return 'Tài khoản hiện tại không có quyền thực hiện thao tác này.';
  if (error?.status >= 500 && (!error.data?.error?.message || /^internal server error\.?$/i.test(error.message))) {
    return 'Máy chủ gặp lỗi. Hãy kiểm tra trạng thái hiện tại trước khi thử lưu lại.';
  }
  if (error?.message === 'Failed to fetch' || error?.message === 'NetworkError when attempting to fetch resource.') {
    return 'Không kết nối được máy chủ. Hãy kiểm tra kết nối rồi thử lại.';
  }
  return error?.message || 'Không thể lưu thay đổi. Vui lòng thử lại.';
}
