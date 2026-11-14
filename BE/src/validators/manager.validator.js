import { httpError } from '../utils/http-error.js';

function objectBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'body phải là object.');
  const unsupported = Object.keys(body).find((key) => !allowed.includes(key));
  if (unsupported) throw httpError(400, `Trường không được hỗ trợ: ${unsupported}.`);
}

function text(value, field, { required = false, max = 500 } = {}) {
  if (typeof value !== 'string') throw httpError(400, `${field} phải là chuỗi.`);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max) throw httpError(400, `${field} không hợp lệ.`);
  return normalized;
}

function amount(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw httpError(400, `${field} phải là số nguyên không âm.`);
  return value;
}

export function parseManagerBookingDecision(body) {
  objectBody(body, ['action', 'reason']);
  if (!['approve', 'reject'].includes(body.action)) throw httpError(400, 'action phải là approve hoặc reject.');
  const reason = body.reason === undefined ? '' : text(body.reason, 'reason', { max: 1000 });
  if (body.action === 'reject' && !reason) throw httpError(400, 'Vui lòng nhập lý do từ chối.');
  return { action: body.action, reason };
}

export function parseManagerListingUpdate(body) {
  objectBody(body, ['title', 'description', 'dailyPrice', 'securityDepositAmount', 'pickupLocation']);
  if (!Object.keys(body).length) throw httpError(400, 'Cần ít nhất một trường để cập nhật tin xe.');
  const update = {};
  if (body.title !== undefined) update.title = text(body.title, 'title', { required: true, max: 160 });
  if (body.description !== undefined) update.description = text(body.description, 'description', { max: 3000 });
  if (body.dailyPrice !== undefined) update.daily_price = amount(body.dailyPrice, 'dailyPrice');
  if (body.securityDepositAmount !== undefined) update.security_deposit_amount = amount(body.securityDepositAmount, 'securityDepositAmount');
  if (body.pickupLocation !== undefined) {
    objectBody(body.pickupLocation, ['branchName', 'city', 'addressLabel']);
    update.pickup_location = {
      ...(body.pickupLocation.branchName !== undefined ? { branch_name: text(body.pickupLocation.branchName, 'branchName', { required: true, max: 120 }) } : {}),
      ...(body.pickupLocation.city !== undefined ? { city: text(body.pickupLocation.city, 'city', { required: true, max: 100 }) } : {}),
      ...(body.pickupLocation.addressLabel !== undefined ? { address_label: text(body.pickupLocation.addressLabel, 'addressLabel', { max: 300 }) } : {}),
    };
    if (!Object.keys(update.pickup_location).length) throw httpError(400, 'pickupLocation phải có ít nhất một trường.');
  }
  return update;
}

export function parseManagerListingReview(body) {
  objectBody(body, ['action', 'reason']);
  if (!['approve', 'reject', 'activate', 'deactivate'].includes(body.action)) throw httpError(400, 'action không hợp lệ.');
  const reason = body.reason === undefined ? '' : text(body.reason, 'reason', { max: 1000 });
  if (body.action === 'reject' && !reason) throw httpError(400, 'Vui lòng nhập lý do từ chối.');
  return { action: body.action, reason };
}
