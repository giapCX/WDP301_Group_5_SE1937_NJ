const mongoose = require('mongoose');
const { Booking, Incident, Refund, BookingChangeRequest, Payment } = require('../models');
const { runInTransaction } = require('./booking.repository');
const { nextIds } = require('./renter-reservation.repository');
const HttpError = require('../utils/http-error');
const { positiveId } = require('../utils/numeric-id');
function page(query = {}) {
  const number = query.page === undefined ? 1 : positiveId(query.page, 'Trang');
  if (number > 1000000) throw new HttpError(400, 'Trang không hợp lệ');
  return { page: number, limit: 10, skip: (number - 1) * 10 };
}
async function list(kind, query = {}, renterId) {
  const { page: number, limit, skip } = page(query);
  const model = { cancellations: Booking, incidents: Incident, refunds: Refund }[kind];
  if (!model) throw new HttpError(400, 'Loại hồ sơ không hợp lệ');
  const filter = kind === 'cancellations' ? { 'cancellation.id': { $exists: true } } : {};
  if (query.booking_id !== undefined) filter.booking_id = positiveId(query.booking_id, 'Booking');
  if (renterId !== undefined) {
    const owned = await Booking.find({ renter_id: renterId }).select('booking_id').lean();
    filter.booking_id = { $in: owned.map((item) => item.booking_id), ...(filter.booking_id ? { $eq: filter.booking_id } : {}) };
  }
  if (query.status) {
    if (!['pending', 'approved', 'rejected', 'open', 'resolved', 'completed'].includes(query.status)) throw new HttpError(400, 'Trạng thái không hợp lệ');
    filter[kind === 'cancellations' ? 'cancellation.status' : kind === 'incidents' ? 'incident_status' : 'refund_status'] = query.status;
  }
  const [items, total] = await Promise.all([
    model.find(filter).select(kind === 'cancellations' ? 'booking_id renter_id booking_status pickup_time paid_total refunded_total cancellation operation_events' : '-_id').sort({ _id: -1 }).skip(skip).limit(limit).lean(),
    model.countDocuments(filter),
  ]);
  return { items, total, page: number, total_pages: Math.ceil(total / limit) };
}
async function booking(id, actor, session = null) {
  const record = await Booking.findOne({ booking_id: positiveId(id, 'Booking') }).session(session);
  if (!record || (actor.role_name === 'renter' && record.renter_id !== actor.user_id)) throw new HttpError(404, 'Không tìm thấy booking');
  return record;
}
async function policy(session) {
  return mongoose.connection.db.collection('service_policies').findOne({ status: 'active' }, { session, sort: { updated_at: -1, policy_id: -1 } });
}
async function summary(id, actor) {
  const record = await booking(id, actor);
  id = record.booking_id;
  const [changes, refunds, incidents] = await Promise.all([
    BookingChangeRequest.find({ booking_id: id }).select('-_id').sort({ requested_at: -1 }).limit(20).lean(),
    Payment.find({ booking_id: id }).select('payment_id').lean().then((payments) => Refund.find({ $or: [{ booking_id: id }, { payment_id: { $in: payments.map((payment) => payment.payment_id) } }] }).select('-_id').sort({ created_at: -1 }).limit(20).lean()),
    Incident.find({ booking_id: id }).select('-_id').sort({ incident_id: -1 }).limit(20).lean(),
  ]);
  return { booking_id: id, cancellation: record.cancellation, events: record.operation_events,
    charges: record.additional_charges, changes, refunds, incidents, refunded_total: record.refunded_total };
}

module.exports = { summary, list, booking, policy, page, transaction: runInTransaction, nextIds };
