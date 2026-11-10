import { useState } from 'react';
import {
  createIncident,
  decideBooking,
  getOperationStaff,
  overdueAction,
  reviewListing,
  reviewViolation,
  updateComplaint,
  updateDispute,
  updateIncident,
  updateListing,
} from '../api/operationApi';
import { getCaseUpdater, operationStatusLabels } from '../operationConfig';

const field = (name, label, type = 'text', value = '', extra = {}) => ({ name, label, type, value, ...extra });

export function useOperationActions({ section, currentUser, perform, setError }) {
  const [dialog, setDialog] = useState(null);
  const caseUpdater = getCaseUpdater(section, { updateIncident, updateDispute, updateComplaint });

  const open = (config) => setDialog({ values: {}, ...config });
  const closeDialog = () => setDialog(null);

  const reviewBooking = (item, action) => open({
    kind: 'booking', item, action,
    title: action === 'approve' ? 'Duyệt booking' : 'Từ chối booking',
    description: `Booking ${item.bookingCode}`,
    confirmLabel: action === 'approve' ? 'Xác nhận duyệt' : 'Từ chối booking',
    fields: action === 'reject' ? [field('reason', 'Lý do từ chối', 'textarea', '', { required: true, maxLength: 1000 })] : [],
  });

  const reviewVehicleListing = (item, action) => open({
    kind: 'listingReview', item, action, title: 'Cập nhật trạng thái tin xe',
    description: `Tin xe: ${item.title || item.id}`,
    confirmLabel: action === 'reject' ? 'Từ chối tin xe' : operationStatusLabels[action] || 'Xác nhận',
    fields: action === 'reject' ? [field('reason', 'Lý do từ chối', 'textarea', '', { required: true, maxLength: 1000 })] : [],
  });

  const editVehicleListing = (item) => open({
    kind: 'editListing', item, title: 'Chỉnh sửa tin xe', confirmLabel: 'Lưu thay đổi',
    fields: [
      field('title', 'Tên tin xe', 'text', item.title || '', { required: true, maxLength: 160 }),
      field('description', 'Mô tả', 'textarea', item.description || '', { maxLength: 3000 }),
      field('dailyPrice', 'Giá thuê mỗi ngày (VND)', 'number', item.dailyPrice ?? '', { required: true, min: 0, step: 1 }),
      field('securityDepositAmount', 'Tiền đặt cọc (VND)', 'number', item.securityDepositAmount ?? '', { min: 0, step: 1 }),
    ],
  });

  const changeCaseStatus = (item, nextStatus) => open({
    kind: 'caseStatus', item, nextStatus, title: 'Cập nhật hồ sơ',
    description: `Trạng thái mới: ${operationStatusLabels[nextStatus] || nextStatus}`,
    confirmLabel: 'Lưu cập nhật',
    fields: [field('note', 'Ghi chú xử lý', 'textarea', '', { maxLength: 2000 })],
  });

  const assignCase = async (item) => {
    try {
      const result = await getOperationStaff();
      const staff = result.data || [];
      if (!staff.length) {
        setError('Không tìm thấy Operation Staff đang hoạt động để phân công.');
        return;
      }
      open({
        kind: 'assignCase', item, title: 'Phân công xử lý', confirmLabel: 'Phân công',
        fields: [
          field('assignedStaffId', 'Nhân sự phụ trách', 'select', staff.find((person) => person.email?.toLowerCase() === currentUser?.email?.toLowerCase())?.id || '', {
            required: true,
            options: staff.map((person) => ({ value: person.id, label: `${person.name} · ${person.email}` })),
          }),
          field('note', 'Ghi chú phân công', 'textarea', '', { maxLength: 2000 }),
        ],
      });
    } catch (reason) {
      setError(reason.message || 'Không thể tải danh sách nhân sự.');
    }
  };

  const decideTrafficViolation = (item, decision) => open({
    kind: 'violation', item, decision, title: 'Trình Manager xem xét vi phạm',
    confirmLabel: 'Gửi Manager xem xét',
    fields: decision === 'confirm'
      ? [field('penaltyFee', 'Khoản phạt đề xuất (VND)', 'number', item.trafficViolation?.fine_amount_claimed || 0, { required: true, min: 0, step: 1 })]
      : [field('note', 'Lý do bác bỏ vi phạm', 'textarea', '', { required: true, maxLength: 2000 })],
  });

  const handleOverdueAction = (item, action) => open({
    kind: 'overdue', item, action,
    title: action === 'remind' ? 'Nhắc khách trả xe' : 'Xác nhận đã xử lý',
    description: action === 'remind'
      ? `Gửi nhắc trả xe cho ${item.renter?.full_name || item.bookingCode}?`
      : `Đánh dấu booking ${item.bookingCode} đã được xử lý?`,
    confirmLabel: action === 'remind' ? 'Gửi nhắc khách' : 'Đánh dấu đã xử lý',
    fields: [field('note', 'Ghi chú (không bắt buộc)', 'textarea', '', { maxLength: 1000 })],
  });

  const createCaseFromOverdue = (item, caseType) => open({
    kind: 'createOverdueCase', item, caseType, title: caseType === 'traffic_violation' ? 'Tạo hồ sơ vi phạm' : 'Tạo hồ sơ sự cố quá hạn',
    confirmLabel: 'Tạo hồ sơ',
    fields: [field('description', 'Mô tả hồ sơ', 'textarea', `Booking ${item.bookingCode} quá hạn ${item.overdueHours} giờ.`, { required: true, maxLength: 3000 })],
  });

  const createCase = () => open({
    kind: 'createCase', title: 'Tạo hồ sơ sự cố', confirmLabel: 'Tạo hồ sơ',
    fields: [
      field('caseType', 'Loại sự cố', 'select', 'other', { required: true, options: [
        { value: 'damage', label: 'Hư hỏng xe' }, { value: 'accident', label: 'Tai nạn' },
        { value: 'safety', label: 'An toàn' }, { value: 'overdue', label: 'Quá hạn' },
        { value: 'other', label: 'Khác' },
      ] }),
      field('description', 'Mô tả sự cố', 'textarea', '', { required: true, maxLength: 3000 }),
    ],
  });

  const updateCaseDetail = (item, action) => open({
    kind: action === 'note' ? 'caseNote' : 'caseEvidence', item,
    title: action === 'note' ? 'Thêm ghi chú xác minh' : 'Đính kèm chứng cứ',
    confirmLabel: action === 'note' ? 'Lưu ghi chú' : 'Đính kèm chứng cứ',
    fields: action === 'note'
      ? [field('note', 'Nội dung ghi chú', 'textarea', '', { required: true, maxLength: 2000 })]
      : [
        field('kind', 'Loại chứng cứ', 'select', 'document', { required: true, options: [
          { value: 'document', label: 'Tài liệu' }, { value: 'image', label: 'Hình ảnh' },
          { value: 'video', label: 'Video' }, { value: 'other', label: 'Khác' },
        ] }),
        field('fileKey', 'Mã lưu trữ chứng cứ', 'text', '', { required: true, maxLength: 500 }),
      ],
  });

  const submitDialog = async (event) => {
    event.preventDefault();
    if (!dialog) return;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const { item } = dialog;
    let operation;
    let success;

    switch (dialog.kind) {
      case 'booking':
        operation = () => decideBooking(item.id, { action: dialog.action, ...(values.reason ? { reason: values.reason.trim() } : {}) });
        success = dialog.action === 'approve' ? 'Đã duyệt booking.' : 'Đã từ chối booking.';
        break;
      case 'listingReview':
        operation = () => reviewListing(item.id, { action: dialog.action, ...(values.reason ? { reason: values.reason.trim() } : {}) });
        success = 'Đã cập nhật trạng thái tin xe.';
        break;
      case 'editListing': {
        const body = { title: values.title.trim(), description: values.description.trim(), dailyPrice: Number(values.dailyPrice) };
        if (values.securityDepositAmount !== '') body.securityDepositAmount = Number(values.securityDepositAmount);
        if (!Number.isSafeInteger(body.dailyPrice) || body.dailyPrice < 0 || (body.securityDepositAmount !== undefined && (!Number.isSafeInteger(body.securityDepositAmount) || body.securityDepositAmount < 0))) {
          setError('Giá thuê và tiền đặt cọc phải là số nguyên không âm.');
          return;
        }
        operation = () => updateListing(item.id, body);
        success = 'Đã lưu thông tin tin xe.';
        break;
      }
      case 'caseStatus':
        operation = () => caseUpdater(item.id, { status: dialog.nextStatus, ...(values.note.trim() ? { note: values.note.trim() } : {}) });
        success = 'Đã cập nhật hồ sơ.';
        break;
      case 'assignCase': {
        operation = () => caseUpdater(item.id, { assignedStaffId: values.assignedStaffId, ...(values.note.trim() ? { note: values.note.trim() } : {}) });
        const assignee = dialog.fields[0].options.find((person) => person.value === values.assignedStaffId);
        success = `Đã phân công cho ${assignee?.label.split(' · ')[0] || 'nhân sự'}.`;
        break;
      }
      case 'violation':
        operation = () => reviewViolation(item.id, dialog.decision === 'confirm'
          ? { decision: 'confirm', penaltyFee: Number(values.penaltyFee) }
          : { decision: 'reject', note: values.note.trim() });
        success = dialog.decision === 'confirm' ? 'Đã gửi đề xuất xác nhận vi phạm cho Manager.' : 'Đã gửi đề xuất bác bỏ vi phạm cho Manager.';
        break;
      case 'overdue':
        operation = () => overdueAction(item.id, { action: dialog.action, ...(values.note.trim() ? { note: values.note.trim() } : {}) });
        success = dialog.action === 'remind' ? 'Đã gửi thông báo nhắc trả xe.' : 'Đã đánh dấu quá hạn đã xử lý.';
        break;
      case 'createOverdueCase':
        operation = () => createIncident({ caseType: dialog.caseType, description: values.description.trim(), bookingId: item.id, vehicleId: item.vehicle?.id || item.vehicle?._id?.toString() });
        success = dialog.caseType === 'traffic_violation' ? 'Đã tạo hồ sơ vi phạm.' : 'Đã tạo hồ sơ sự cố quá hạn.';
        break;
      case 'createCase':
        operation = () => createIncident({ caseType: values.caseType, description: values.description.trim() });
        success = 'Đã tạo hồ sơ sự cố.';
        break;
      case 'caseNote':
        operation = () => caseUpdater(item.id, { note: values.note.trim() });
        success = 'Đã thêm ghi chú.';
        break;
      case 'caseEvidence':
        operation = () => caseUpdater(item.id, { evidence: [{ kind: values.kind, fileKey: values.fileKey.trim() }] });
        success = 'Đã đính kèm chứng cứ.';
        break;
      default:
        return;
    }

    setDialog(null);
    await perform(operation, success);
  };

  const proposeCompensation = (item, proposal) => perform(
    () => caseUpdater(item.id, { compensationProposal: proposal }),
    'Đã gửi đề xuất cho Manager xem xét.',
  );

  const handleAction = (type, item, value) => {
    if (type === 'booking') return reviewBooking(item, value);
    if (type === 'listing') return reviewVehicleListing(item, value);
    if (type === 'editListing') return editVehicleListing(item);
    if (type === 'caseStatus') return changeCaseStatus(item, value);
    if (type === 'assignCase') return assignCase(item);
    if (type === 'violation') return decideTrafficViolation(item, value);
    if (type === 'overdue') return handleOverdueAction(item, value);
    if (type === 'createOverdueCase') return createCaseFromOverdue(item, value);
    return undefined;
  };

  return { createCase, dialog, closeDialog, handleAction, proposeCompensation, submitDialog, updateCaseDetail };
}
