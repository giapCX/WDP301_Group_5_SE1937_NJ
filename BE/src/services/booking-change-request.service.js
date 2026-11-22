const changeRequestRepository = require('../repositories/booking-change-request.repository');
const { BookingChangeRequest } = require('../models');
const HttpError = require('../utils/http-error');

function parsePositiveInteger(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : value;

  if (
    (typeof normalized !== 'number' && typeof normalized !== 'string') ||
    (typeof normalized === 'string' && !/^\d+$/.test(normalized))
  ) {
    throw new HttpError(400, `${field} phải là số nguyên dương`);
  }

  const number = Number(normalized);

  if (!Number.isSafeInteger(number) || number < 1) {
    throw new HttpError(400, `${field} phải là số nguyên dương hợp lệ`);
  }

  return number;
}

async function getChangeRequests(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new HttpError(400, 'Tham số tìm kiếm không hợp lệ');
  }

  const page = query.page === undefined ? 1 : parsePositiveInteger(query.page, 'page');
  const limit =
    query.limit === undefined ? 10 : parsePositiveInteger(query.limit, 'limit');

  if (limit > 10) {
    throw new HttpError(400, 'limit không được vượt quá 10');
  }

  if (!Number.isSafeInteger((page - 1) * limit)) {
    throw new HttpError(400, 'Phạm vi phân trang quá lớn');
  }

  let status;

  if (query.status !== undefined) {
    const allowedStatuses = BookingChangeRequest.schema.path('request_status').enumValues;

    if (typeof query.status !== 'string') {
      throw new HttpError(400, 'status phải là chuỗi');
    }

    status = query.status.trim();

    if (!allowedStatuses.includes(status)) {
      throw new HttpError(400, `status phải là một trong: ${allowedStatuses.join(', ')}`);
    }
  }

  const bookingId =
    query.booking_id === undefined
      ? undefined
      : parsePositiveInteger(query.booking_id, 'booking_id');

  return changeRequestRepository.findChangeRequests({
    status,
    bookingId,
    page,
    limit,
  });
}

async function getChangeRequestById(id) {
  const changeRequestId = parsePositiveInteger(id, 'change_request_id');
  const request = await changeRequestRepository.findChangeRequestById(changeRequestId);

  if (!request) {
    throw new HttpError(404, 'Không tìm thấy yêu cầu thay đổi booking');
  }

  return request;
}

module.exports = {
  getChangeRequests,
  getChangeRequestById,
};
