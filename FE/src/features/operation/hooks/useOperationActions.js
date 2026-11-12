import { useState } from 'react';
import {
  createIncident,
  decideBooking,
  getGarageStaff,
  getOperationStaff,
  overdueAction,
  reviewListing,
  reviewViolation,
  screenVehicle,
  updateComplaint,
  updateDispute,
  updateIncident,
  updateListing,
} from '../api/operationApi';
import { operationStatusLabels } from '../operationConfig';

function caseUpdater(section) {
  if (section === 'disputes') return updateDispute;
  if (section === 'complaints') return updateComplaint;
  return updateIncident;
}

const field = (name, label, type = 'text', value = '', extra = {}) => ({ name, label, type, value, ...extra });

export function useOperationActions({ section, currentUser, perform, setError }) {
  const [dialog, setDialog] = useState(null);

  const open = (config) => setDialog(config);
  const closeDialog = () => setDialog(null);

  const reviewBooking = (item, action) => open({
    kind: 'booking', item, action,
    title: action === 'approve' ? 'Duyệt booking' : 'Từ chối booking',
    description: `Booking ${item.bookingCode}`,
    confirmLabel: action === 'approve' ? 'Xác nhận duyệt' : 'Từ chối booking',
    fields: action === 'reject' ? [field('reason', 'Lý do từ chối', 'textarea', '', { required: true, maxLength: 1000 })] : [],
  });

  // Vehicle onboarding: request corrected documents or schedule a Garage inspection.
  const screenVehicleRecord = async (item, action) => {
    if (action === 'request_revision') {
      const note = window.prompt('Ghi rõ hồ sơ cần bổ sung hoặc chỉnh sửa:', '');
      if (!note?.trim()) return;
      perform(() => screenVehicle(item.id, { action, note }), 'Đã gửi yêu cầu bổ sung hồ sơ cho chủ xe.');
      return;
    }

    try {
      const result = await getGarageStaff();
      const staff = result.data || [];
      if (!staff.length) {
        setError('Không tìm thấy Garage Staff đang hoạt động để phân công kiểm định.');
        return;
      }
      const choice = window.prompt(
        `Chọn Garage Staff bằng email:\n${staff.map((person) => `${person.email} — ${person.name}`).join('\n')}`,
        '',
      );
      if (!choice) return;
      const assignee = staff.find((person) => person.email.toLowerCase() === choice.trim().toLowerCase());
      if (!assignee) {
        setError('Email không thuộc Garage Staff đang hoạt động.');
        return;
      }
      const scheduledFor = window.prompt(
        'Thời gian kiểm định (ISO 8601):',
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      );
      if (!scheduledFor || Number.isNaN(Date.parse(scheduledFor))) {
        setError('Thời gian kiểm định không hợp lệ.');
        return;
      }
      const note = window.prompt('Địa điểm hoặc ghi chú lịch hẹn:', '');
      if (note === null || !note.trim()) return;
      perform(
        () => screenVehicle(item.id, { action, garageStaffId: assignee.id, scheduledFor, note }),
        `Đã phân công kiểm định cho ${assignee.name}.`,
      );
    } catch (reason) {
      setError(reason.message);
    }
  };

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

  const updateCase = (item, nextStatus) => open({
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

  const submitViolationRecommendation = (item, decision) => open({
    kind: 'violation', item, decision, title: 'Trình Manager xem xét vi phạm',
    confirmLabel: 'Gửi Manager xem xét',
    fields: decision === 'confirm'
      ? [field('penaltyFee', 'Khoản phạt đề xuất (VND)', 'number', item.trafficViolation?.fine_amount_claimed || 0, { required: true, min: 0, step: 1 })]
      : [field('note', 'Lý do bác bỏ vi phạm', 'textarea', '', { required: true, maxLength: 2000 })],
  });

  const actOnOverdueBooking = (item, action) => open({
    kind: 'overdue', item, action,
    title: { remind: 'Nhắc khách trả xe', handled: 'Xác nhận đã xử lý', escalate: 'Chuyển Manager' }[action],
    description: action === 'remind'
      ? `Gửi nhắc trả xe cho ${item.renter?.full_name || item.bookingCode}?`
      : action === 'escalate'
        ? 'Xác nhận đã quá hạn ít nhất 4 giờ và không liên hệ được người thuê.'
        : `Đánh dấu booking ${item.bookingCode} đã được xử lý?`,
    confirmLabel: { remind: 'Gửi nhắc khách', handled: 'Đánh dấu đã xử lý', escalate: 'Chuyển Manager' }[action],
    fields: [field('note', 'Ghi chú (không bắt buộc)', 'textarea', '', { maxLength: 1000 })],
  });

  const createOverdueCase = (item, caseType) => open({
    kind: 'createOverdueCase', item, caseType, title: caseType === 'traffic_violation' ? 'Tạo hồ sơ vi phạm' : 'Tạo hồ sơ sự cố quá hạn',
    confirmLabel: 'Tạo hồ sơ',
    fields: [field('description', 'Mô tả hồ sơ', 'textarea', `Booking ${item.bookingCode} quá hạn ${item.overdueHours} giờ.`, { required: true, maxLength: 3000 })],
  });

  const createIncidentCase = () => open({
    kind: 'createCase', title: 'Tạo hồ sơ sự cố', confirmLabel: 'Tạo hồ sơ',
    fields: [
      field('caseType', 'Loại sự cố', 'select', 'other', { required: true, options: [
        { value: 'damage', label: 'Hư hỏng xe' }, { value: 'accident', label: 'Tai nạn' },
        { value: 'safety', label: 'An toàn' }, { value: 'overdue', label: 'Quá hạn' },
        { value: 'other', label: 'Khác' },
      ] }),
      field('vehicleId', 'ObjectId xe liên quan (24 ký tự)', 'text', '', { required: true, maxLength: 24 }),
      field('description', 'Mô tả sự cố', 'textarea', '', { required: true, maxLength: 3000 }),
    ],
  });

  const submitDialog = async (event) => {
    event.preventDefault();
    if (!dialog) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    for (const { name, required } of dialog.fields) {
      values[name] = values[name].trim();
      if (required && !values[name]) {
        form.elements.namedItem(name).focus();
        setError('Hãy điền đầy đủ thông tin bắt buộc.');
        return;
      }
    }
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
        const body = { title: values.title, dailyPrice: Number(values.dailyPrice) };
        if (values.description || item.description !== undefined) body.description = values.description;
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
        operation = () => caseUpdater(section)(item.id, { status: dialog.nextStatus, ...(values.note.trim() ? { note: values.note.trim() } : {}) });
        success = 'Đã cập nhật hồ sơ.';
        break;
      case 'assignCase': {
        operation = () => caseUpdater(section)(item.id, { assignedStaffId: values.assignedStaffId, ...(values.note.trim() ? { note: values.note.trim() } : {}) });
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
        success = {
          remind: 'Đã gửi thông báo nhắc trả xe.',
          handled: 'Đã đánh dấu quá hạn đã xử lý.',
          escalate: 'Đã chuyển Manager và thông báo chủ xe.',
        }[dialog.action];
        break;
      case 'createOverdueCase':
        operation = () => createIncident({ caseType: dialog.caseType, description: values.description.trim(), bookingId: item.id, vehicleId: item.vehicle?.id || item.vehicle?._id?.toString() });
        success = dialog.caseType === 'traffic_violation' ? 'Đã tạo hồ sơ vi phạm.' : 'Đã tạo hồ sơ sự cố quá hạn.';
        break;
      case 'createCase':
        if (!/^[a-f\d]{24}$/i.test(values.vehicleId)) {
          setError('Cần ObjectId hợp lệ của xe liên quan.');
          return;
        }
        operation = () => createIncident({ caseType: values.caseType, description: values.description, vehicleId: values.vehicleId });
        success = 'Đã tạo hồ sơ sự cố.';
        break;
      default:
        return;
    }

    setDialog(null);
    await perform(operation, success);
  };

  return {
    reviewBooking,
    screenVehicleRecord,
    reviewVehicleListing,
    editVehicleListing,
    updateCase,
    assignCase,
    submitViolationRecommendation,
    actOnOverdueBooking,
    createOverdueCase,
    createIncidentCase,
    dialog,
    closeDialog,
    submitDialog,
  };
}
