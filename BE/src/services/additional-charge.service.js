const { randomInt } = require('node:crypto');
const repository = require('../repositories/additional-charge.repository');
const { CHARGE_TYPES, CHARGE_STATUSES } = require('../models/additional-charge.schema');
const HttpError = require('../utils/http-error');

function id(value, field) {
  if (
    !['number', 'string'].includes(typeof value) ||
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1
  ) {
    throw new HttpError(400, `${field} phải là số nguyên dương`);
  }
  return Number(value);
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000) {
    throw new HttpError(400, `${field} phải có từ 1 đến 2000 ký tự`);
  }
  return value.trim();
}

function evidence(value = []) {
  if (
    !Array.isArray(value) ||
    value.length > 10 ||
    value.some((item) => {
      if (typeof item !== 'string' || item.length > 1000) return true;
      try {
        const url = new URL(item);
        return url.protocol !== 'https:' || Boolean(url.username || url.password);
      } catch {
        return true;
      }
    })
  )
    throw new HttpError(400, 'Bằng chứng phải là tối đa 10 URL HTTPS hợp lệ');
  return [...value];
}

function fields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new HttpError(400, 'Dữ liệu khoản phí không hợp lệ');
  if (!CHARGE_TYPES.includes(body.type))
    throw new HttpError(400, 'Loại phụ phí không hợp lệ');
  if (
    typeof body.quantity !== 'number' ||
    !Number.isFinite(body.quantity) ||
    body.quantity < 0.001 ||
    body.quantity > 1000000
  )
    throw new HttpError(400, 'Số lượng không hợp lệ');
  if (!Number.isSafeInteger(body.unit_price) || body.unit_price < 1)
    throw new HttpError(400, 'Đơn giá phải là số nguyên VND dương');
  const amount = Math.round(body.quantity * body.unit_price);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1e12)
    throw new HttpError(400, 'Thành tiền không hợp lệ');
  return {
    type: body.type,
    description: text(body.description, 'Mô tả'),
    quantity: body.quantity,
    unit_price: body.unit_price,
    amount,
    evidence: evidence(body.evidence),
  };
}

async function ownedBooking(bookingId, renterId, session = null) {
  const booking = await repository.findBooking(id(bookingId, 'booking_id'), session);
  if (!booking) throw new HttpError(404, 'Không tìm thấy booking');
  if (renterId !== undefined && booking.renter_id !== id(renterId, 'renter_id'))
    throw new HttpError(403, 'Bạn không sở hữu booking này');
  return booking;
}

function getCharge(booking, chargeId) {
  const charge = (booking.additional_charges || []).find(
    (item) => item.charge_id === id(chargeId, 'charge_id'),
  );
  if (!charge) throw new HttpError(404, 'Không tìm thấy khoản phụ phí');
  return charge;
}

async function list(query = {}, bookingId, renterId) {
  const page = query.page === undefined ? 1 : id(query.page, 'page');
  const limit = query.limit === undefined ? 10 : id(query.limit, 'limit');
  if (limit > 10 || !Number.isSafeInteger((page - 1) * limit))
    throw new HttpError(400, 'Phân trang không hợp lệ; tối đa 10 bản ghi');
  let selected = bookingId === undefined ? query.booking_id : bookingId;
  if (selected !== undefined) {
    selected = id(selected, 'booking_id');
    await ownedBooking(selected, renterId);
  }
  if (query.status !== undefined && !CHARGE_STATUSES.includes(query.status))
    throw new HttpError(400, 'Trạng thái không hợp lệ');
  if (query.type !== undefined && !CHARGE_TYPES.includes(query.type))
    throw new HttpError(400, 'Loại phụ phí không hợp lệ');
  return repository.listCharges({
    bookingId: selected,
    page,
    limit,
    status: query.status,
    type: query.type,
  });
}

async function detail(bookingId, chargeId, renterId) {
  const booking = await ownedBooking(bookingId, renterId);
  return {
    booking_id: booking.booking_id,
    additional_charge: booking.additional_charge,
    charge: getCharge(booking, chargeId),
  };
}

// Only confirmed/disputed charges contribute to the stored booking total.
function contribution(charge) {
  return ['confirmed', 'disputed'].includes(charge.status) ? charge.amount : 0;
}

async function mutate(action, bookingId, chargeId, body = {}, actorId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Dữ liệu thao tác không hợp lệ');
  }
  const operatorId = id(actorId, 'actor_id');
  const selectedBooking = id(bookingId, 'booking_id');
  return repository.transaction(async (session) => {
    const booking = await ownedBooking(
      selectedBooking,
      action === 'dispute' ? operatorId : undefined,
      session,
    );
    const charges = booking.additional_charges || [];
    let charge;
    let previous = 0;
    let note;
    let proof;
    if (action === 'create') {
      if (!['confirmed', 'in_progress', 'completed'].includes(booking.booking_status))
        throw new HttpError(409, 'Booking không đủ điều kiện ghi nhận phụ phí');
      if (charges.length >= 100)
        throw new HttpError(409, 'Booking đã có tối đa 100 khoản phụ phí');
      charge = {
        charge_id: randomInt(1, 2 ** 48 - 1),
        ...fields(body),
        status: 'draft',
        created_by: operatorId,
        created_at: new Date(),
        history: [],
      };
      charges.push(charge);
      note = body.reason ? text(body.reason, 'Lý do tạo') : 'Tạo khoản phụ phí';
    } else {
      charge = getCharge(booking, chargeId);
      previous = contribution(charge);
      if (action === 'update') {
        if (charge.status !== 'draft') throw new HttpError(409, 'Chỉ sửa khoản phí nháp');
        note = text(body.reason, 'Lý do sửa');
        Object.assign(charge, fields(body));
      } else if (action === 'confirm') {
        if (
          charge.status !== 'draft' ||
          !['confirmed', 'in_progress', 'completed'].includes(booking.booking_status)
        )
          throw new HttpError(409, 'Không thể xác nhận khoản phí này');
        charge.status = 'confirmed';
        note = text(body.reason, 'Lý do xác nhận');
      } else if (action === 'cancel') {
        if (!['draft', 'confirmed'].includes(charge.status))
          throw new HttpError(
            409,
            'Không thể hủy khoản phí này; khoản tranh chấp phải được giải quyết',
          );
        note = text(body.reason, 'Lý do hủy');
        charge.status = 'cancelled';
      } else if (action === 'dispute') {
        if (charge.status !== 'confirmed')
          throw new HttpError(409, 'Chỉ tranh chấp khoản phí đã xác nhận');
        note = text(body.reason, 'Lý do tranh chấp');
        proof = evidence(body.evidence);
        charge.status = 'disputed';
      } else if (action === 'resolve') {
        if (charge.status !== 'disputed')
          throw new HttpError(409, 'Khoản phí không có tranh chấp đang chờ');
        if (!['uphold', 'waive'].includes(body.resolution))
          throw new HttpError(400, 'resolution phải là uphold hoặc waive');
        note = text(body.reason, 'Lý do giải quyết');
        charge.status = body.resolution === 'uphold' ? 'confirmed' : 'cancelled';
      } else throw new HttpError(400, 'Thao tác không hợp lệ');
    }
    charge.updated_at = new Date();
    charge.history.push({
      action: action === 'resolve' ? `resolve_${body.resolution}` : action,
      actor_id: operatorId,
      at: charge.updated_at,
      note,
      type: charge.type,
      description: charge.description,
      quantity: charge.quantity,
      unit_price: charge.unit_price,
      amount: charge.amount,
      status: charge.status,
      evidence: proof || [...charge.evidence],
    });
    // Preserve any legacy aggregate not yet represented by embedded entries.
    const total = booking.additional_charge + contribution(charge) - previous;
    if (!Number.isSafeInteger(total) || total < 0)
      throw new HttpError(409, 'Tổng phụ phí không hợp lệ; cần đối soát dữ liệu booking');
    await repository.saveCharges(selectedBooking, charges, total, session);
    const { Booking } = require('../models');
    await Booking.updateOne({ booking_id: selectedBooking }, { $push: { operation_events: {
      action: 'charge_' + action, actor_id: operatorId, at: new Date(), note,
    } } }, { session });
    if (booking.pricing_breakdown && total < booking.additional_charge) {
      const netPaid = (booking.paid_total || 0) - (booking.refunded_total || 0);
      const due = booking.pricing_breakdown.total + total - (booking.pricing_breakdown.surcharge || 0);
      const { Refund } = require('../models');
      const reserved = await Refund.find({ booking_id: selectedBooking, refund_status: { $in: ['pending', 'approved'] } }).session(session).lean();
      const refundable = Math.max(0, netPaid - due - reserved.reduce((sum, item) => sum + item.amount, 0));
      await require('./cancellation.service').reserveRefunds(booking, refundable, 'Hoàn do giảm phụ phí: ' + note,
        'charge:' + charge.charge_id + ':' + charge.history.length, { user_id: operatorId }, session);
    }
    return { booking_id: selectedBooking, additional_charge: total, charge };
  });
}

module.exports = { list, detail, mutate };
