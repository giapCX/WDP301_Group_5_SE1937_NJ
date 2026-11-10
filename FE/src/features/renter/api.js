import { getApi, postApi, putApi, getBlobApi } from '../../services/httpClient';
export const getRenter = (path, options) => getApi('/renter' + path, options);
export const postRenter = (path, body) => postApi('/renter' + path, body);
export const putRenter = (path, body) => putApi('/renter' + path, body);
export async function uploadRenterFile(file, purpose) {
  const maximum = purpose === 'avatar' ? 5 : purpose === 'identity' ? 10 : 20;
  if (file.size > maximum * 1024 * 1024) throw new Error(`Tệp tối đa ${maximum} MB.`);
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được tệp.'));
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
  return (await postRenter('/files', {
    name: file.name,
    content_type: file.type,
    purpose,
    data
  })).data;
}
export const renterFile = id => getBlobApi('/renter/files/' + encodeURIComponent(id));
export const vnd = value => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND'
}).format(value || 0);
export const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
export const statusName = value => ({
  pending: 'Chờ duyệt',
  awaiting_payment: 'Chờ ký / thanh toán',
  confirmed: 'Đã xác nhận',
  ongoing: 'Đang thuê',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  expired: 'Hết thời gian giữ xe',
  rejected: 'Từ chối',
  reported: 'Đã tiếp nhận',
  investigating: 'Đang xử lý',
  resolved: 'Đã giải quyết',
  verified: 'Đã xác minh',
  unverified: 'Chưa xác minh',
  signed: 'Đã ký',
  pending_signature: 'Chờ ký',
  collected: 'Đã thu cọc',
  refunded: 'Đã hoàn cọc',
  succeeded: 'Thành công',
  requested: 'Đã yêu cầu'
})[value] || value || 'Chưa có';
