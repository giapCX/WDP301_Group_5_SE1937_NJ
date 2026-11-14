import { statusName } from './renterApi';

export function bookingProgress(booking, agreement = booking.agreement) {
  if (booking.status === 'pending' && booking.review_info?.required === false && agreement) {
    if (!agreement.signing_info?.renter_confirmed && !agreement.signing_info?.renter_signed_at) return { label: 'Bạn cần ký hợp đồng', action: 'Ký hợp đồng', step: 'contract' };
    if (!agreement.operator_intake?.confirmed_at) return { label: 'Chờ Operator rà soát', action: 'Xem hợp đồng', step: 'contract' };
    return { label: 'Chờ Manager ký', action: 'Xem hợp đồng', step: 'contract' };
  }
  if (booking.status === 'awaiting_payment' && agreement?.status === 'signed') return { label: 'Chờ thanh toán', action: 'Thanh toán', step: 'payment' };
  if (booking.status === 'confirmed') return { label: 'Chờ nhận xe', action: 'Xem hướng dẫn nhận xe', step: 'pickup' };
  return { label: statusName(booking.status), action: 'Xem chi tiết chuyến đi' };
}
