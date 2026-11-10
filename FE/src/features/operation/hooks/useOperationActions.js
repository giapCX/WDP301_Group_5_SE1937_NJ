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

// Actions are grouped by the Operation Staff work queue they update.
export function useOperationActions({ section, currentUser, perform, setError }) {
  // Booking queue: review/reject requests; approval starts the payment hold.
  const reviewBooking = (item, action) => {
    if (!window.confirm(action === 'approve' ? `Duyệt booking ${item.bookingCode}?` : `Từ chối booking ${item.bookingCode}?`)) return;
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Nhập lý do từ chối (bắt buộc):', '') || '';
      if (!reason.trim()) return;
    }
    perform(
      () => decideBooking(item.id, { action, ...(reason ? { reason } : {}) }),
      action === 'approve' ? 'Đã duyệt booking.' : 'Đã từ chối booking.',
    );
  };

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

  // Listing queue: edit the offer or submit its publication decision.
  const reviewVehicleListing = (item, action) => {
    const reason = action === 'reject' ? window.prompt('Lý do từ chối tin xe:', '') : '';
    if (action === 'reject' && !reason?.trim()) return;
    const actionLabel = {
      approve: 'duyệt',
      reject: 'từ chối',
      activate: 'kích hoạt',
      deactivate: 'tạm dừng',
    }[action];
    if (!window.confirm(`Xác nhận ${actionLabel} tin xe?`)) return;
    perform(
      () => reviewListing(item.id, { action, ...(reason ? { reason } : {}) }),
      'Đã cập nhật trạng thái tin xe.',
    );
  };

  const editVehicleListing = (item) => {
    const title = window.prompt('Tên tin xe:', item.title);
    if (title === null) return;
    const price = window.prompt('Giá thuê mỗi ngày (VND):', String(item.dailyPrice));
    if (price === null) return;
    const dailyPrice = Number(price);
    if (!title.trim() || !Number.isSafeInteger(dailyPrice) || dailyPrice < 0) {
      setError('Tên tin và giá thuê hợp lệ là bắt buộc.');
      return;
    }
    perform(
      () => updateListing(item.id, { title: title.trim(), dailyPrice }),
      'Đã lưu thông tin tin xe.',
    );
  };

  // Case queues: Operation investigates, assigns staff, and forwards decisions to Manager.
  const updateCase = (item, nextStatus, resource = section) => {
    const note = window.prompt('Ghi chú xử lý (không bắt buộc):', '') || '';
    if (!window.confirm(`Chuyển hồ sơ sang “${operationStatusLabels[nextStatus] || nextStatus}”?`)) return;
    perform(
      () => caseUpdater(resource)(item.id, { status: nextStatus, ...(note ? { note } : {}) }),
      'Đã cập nhật hồ sơ.',
    );
  };

  const assignCase = async (item) => {
    try {
      const result = await getOperationStaff();
      const staff = result.data || [];
      if (!staff.length) {
        setError('Không tìm thấy Operation Staff đang hoạt động để phân công.');
        return;
      }
      const choice = window.prompt(
        `Nhập email nhân sự cần phân công:\n${staff.map((person) => `${person.email} — ${person.name}`).join('\n')}`,
        currentUser?.email || '',
      );
      if (!choice) return;
      const assignee = staff.find((person) => person.email.toLowerCase() === choice.trim().toLowerCase());
      if (!assignee) {
        setError('Email không thuộc danh sách Operation Staff/Admin đang hoạt động.');
        return;
      }
      const note = window.prompt('Ghi chú phân công (không bắt buộc):', '') || '';
      perform(
        () => caseUpdater(section)(item.id, { assignedStaffId: assignee.id, ...(note ? { note } : {}) }),
        `Đã phân công cho ${assignee.name}.`,
      );
    } catch (reason) {
      setError(reason.message);
    }
  };

  const submitViolationRecommendation = (item, decision) => {
    const body = { decision };
    if (decision === 'confirm') {
      const raw = window.prompt(
        'Khoản phạt đề xuất để Manager xem xét (VND):',
        String(item.trafficViolation?.fine_amount_claimed || 0),
      );
      if (raw === null || !Number.isSafeInteger(Number(raw)) || Number(raw) < 0) return;
      body.penaltyFee = Number(raw);
    } else {
      body.note = window.prompt('Lý do bác bỏ vi phạm:', '') || '';
      if (!body.note.trim()) return;
    }
    if (!window.confirm('Gửi đề xuất để Manager xem xét; thao tác này chưa quyết định khoản phạt?')) return;
    perform(() => reviewViolation(item.id, body), 'Đã chuyển hồ sơ vi phạm cho Manager quyết định.');
  };

  // Overdue queue: remind, record contact outcome, or escalate after four hours.
  const actOnOverdueBooking = (item, action) => {
    const prompts = {
      remind: `Gửi nhắc trả xe cho ${item.renter?.full_name || item.bookingCode}?`,
      handled: 'Đánh dấu booking đã được xử lý?',
      escalate: 'Xác nhận đã quá hạn ít nhất 4 giờ và không liên hệ được renter; chuyển hồ sơ cho Manager?',
    };
    if (!window.confirm(prompts[action])) return;
    const messages = {
      remind: 'Đã gửi thông báo nhắc trả xe.',
      handled: 'Đã đánh dấu quá hạn đã xử lý.',
      escalate: 'Đã chuyển Manager và thông báo chủ xe.',
    };
    perform(() => overdueAction(item.id, { action }), messages[action]);
  };

  const createOverdueCase = (item, caseType) => {
    const description = window.prompt('Mô tả hồ sơ:', `Booking ${item.bookingCode} quá hạn ${item.overdueHours} giờ.`);
    if (!description?.trim()) return;
    perform(
      () => createIncident({ caseType, description, bookingId: item.id, vehicleId: item.vehicle?.id }),
      caseType === 'traffic_violation' ? 'Đã tạo hồ sơ vi phạm.' : 'Đã tạo hồ sơ sự cố quá hạn.',
    );
  };

  const createIncidentCase = () => {
    const description = window.prompt('Mô tả sự cố mới:', '');
    if (!description?.trim()) return;
    const vehicleId = window.prompt('ObjectId xe liên quan (24 ký tự):', '');
    if (!vehicleId || !/^[a-f\d]{24}$/i.test(vehicleId.trim())) {
      setError('Cần ObjectId hợp lệ của xe liên quan.');
      return;
    }
    perform(
      () => createIncident({ caseType: 'other', description, vehicleId: vehicleId.trim() }),
      'Đã tạo hồ sơ sự cố.',
    );
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
  };
}
