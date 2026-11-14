export const contractStatus = { draft: 'Chờ lập nội dung', awaiting_signature: 'Chờ lập nội dung ký', pending_manager_review: 'Chờ Manager rà soát', pending_signatures: 'Đang trình ký', pending_signature: 'Chờ lập nội dung ký', signed: 'Đã ký đủ', active: 'Có hiệu lực', terminated: 'Đã chấm dứt', expired: 'Hết hạn', cancelled: 'Đã hủy' };
export const time = (value) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa ký';
export const statusTone = (status) => ['active', 'signed'].includes(status) ? 'success' : ['terminated', 'expired', 'cancelled'].includes(status) ? 'muted' : 'pending';
export const signatureState = (name, signedAt, signed = Boolean(signedAt)) => signed ? { title: 'Đã ký', name: name || 'Đã xác nhận', date: signedAt ? time(signedAt) : 'Đã xác nhận' } : { title: 'Chờ ký', name: 'Chưa ghi nhận chữ ký', date: 'Đang chờ xác nhận' };
export const contractTypes = [
  { value: 'management', title: 'Hợp đồng ủy quyền quản lý xe', parties: 'Chủ xe ↔ XeDi', flow: 'Manager rà soát → Chủ xe ký → Manager ký' },
  { value: 'rental', title: 'Hợp đồng thuê xe', parties: 'XeDi ↔ Người thuê', flow: 'Người thuê ký → Operator tiếp nhận → Manager ký' },
];
export const typeTitle = (type) => contractTypes.find((item) => item.value === type)?.title || 'Hợp đồng';
export const contractTemplate = {
  management: {
    title: 'Mẫu hợp đồng ủy quyền cho thuê xe ô tô',
    fileName: 'Hop_dong_uy_quyen_cho_thue_xe_Xedi.docx',
    url: '/contract-templates/authorization.docx',
  },
  rental: {
    title: 'Mẫu hợp đồng thuê xe ô tô tự lái',
    fileName: 'Hop_dong_thue_xe_o_to_tu_lai_Xedi.docx',
    url: '/contract-templates/rental.docx',
  },
};
export function workflowState(item) {
  if (item.status === 'pending_manager_review') return 'Chờ Manager rà soát nội dung';
  if (item.platformSigned ?? Boolean(item.platformSignedAt)) return item.status === 'active' ? 'Đang có hiệu lực' : 'Đã hoàn tất chữ ký';
  if (item.managerReviewStatus === 'approved' && item.partySigned) return 'Chờ Manager ký phía XeDi';
  if (item.operatorIntakeConfirmedAt) return 'Chờ Manager ký phía XeDi';
  if (item.partySigned) return 'Chờ Operator tiếp nhận';
  return item.document ? `Chờ ${item.type === 'management' ? 'Chủ xe' : 'Người thuê'} ký` : 'Chưa có nội dung trình ký';
}

