const { randomUUID } = require('node:crypto');
const { Booking, BookingChangeRequest, Payment, Refund, TripAssignment, TripWorkflow, DriverProfile } = require('../models');
const repository = require('../repositories/operations.repository');
const { lockVehicleSchedule } = require('../repositories/booking.repository');
const { positiveId } = require('../utils/numeric-id');
const HttpError = require('../utils/http-error');
const { text, amount, event, notify } = require('./operation-validation');

function cancellationPrice(booking, policy, at = new Date()) {
  const paid = amount(booking.paid_total || 0);
  const refunded = amount(booking.refunded_total || 0);
  if (['pending', 'quoted', 'awaiting_payment'].includes(booking.booking_status) && !paid) return { fee: 0, refund_amount: 0 };
  if (!policy || !Number.isFinite(policy.cancellation_fee_percent) || policy.cancellation_fee_percent < 0 || policy.cancellation_fee_percent > 100) {
    throw new HttpError(409, 'Manager cần kích hoạt chính sách hủy hợp lệ trước khi xử lý.');
  }
  const freeHours = policy.free_cancellation_hours > 0 ? policy.free_cancellation_hours : null;
  if (freeHours !== null && (!Number.isFinite(freeHours) || freeHours < 0)) throw new HttpError(409, 'Chính sách giờ hủy miễn phí không hợp lệ');
  const hours = (+new Date(booking.pickup_time) - +at) / 3600000;
  const percent = freeHours !== null && hours >= freeHours ? 0 : policy.cancellation_fee_percent;
  const total = amount(booking.pricing_breakdown?.total ?? booking.estimated_price);
  const fee = Math.round(total * percent / 100);
  return { fee, refund_amount: Math.max(0, paid - refunded - fee),
    policy: { policy_id: policy.policy_id, name: policy.name, fee_percent: percent, free_hours: freeHours, hours_before: hours } };
}
async function reconcilePaid(booking, session) {
  const records = await Payment.find({ booking_id: booking.booking_id, payment_status: 'paid' }).session(session).lean();
  const total = records.reduce((sum, record) => sum + record.amount, 0);
  if (booking.paid_total == null) booking.paid_total = total;
  else if (booking.paid_total !== total) throw new HttpError(409, 'Tiền đã thu không khớp lịch sử giao dịch; cần đối soát trước khi hủy');
}
async function assertCancellable(booking, session) {
  if (!['pending', 'quoted', 'awaiting_payment', 'confirmed'].includes(booking.booking_status) || new Date(booking.pickup_time) <= new Date()) throw new HttpError(409, 'Chỉ hủy đơn chưa khởi hành');
  const workflow = await TripWorkflow.findOne({ booking_id: booking.booking_id }).session(session).lean();
  if (workflow?.vehicle_received) throw new HttpError(409, 'Xe đã bàn giao; cần xử lý ngoại lệ qua sự cố');
}
async function preview(id, actor) {
  const booking = await repository.booking(id, actor);
  await assertCancellable(booking, null);
  await reconcilePaid(booking, null);
  const price = cancellationPrice(booking, await repository.policy(null));
  return { ...price, paid_total: booking.paid_total || 0, requested: booking.cancellation };
}
async function request(id, input, actor) {
  const reason = text(input.reason);
  return repository.transaction(async (session) => {
    const booking = await repository.booking(id, actor, session);
    await assertCancellable(booking, session);
    await reconcilePaid(booking, session);
    if (booking.cancellation?.status === 'pending') throw new HttpError(409, 'Đã có yêu cầu hủy đang chờ');
    const at = new Date();
    const price = cancellationPrice(booking, await repository.policy(session), at);
    booking.cancellation = { id: randomUUID(), status: 'pending', reason, requested_by: actor.user_id, requested_at: at, ...price };
    notify(booking, 'cancellation_requested', actor, `${reason} · Phí dự kiến ${price.fee}đ · Hoàn dự kiến ${price.refund_amount}đ · ${price.policy?.name || 'Chưa thu tiền'}`);
    await booking.save({ session });
    return booking.cancellation;
  });
}
// Reserve refundable amounts per payment. A pending/approved refund already consumes capacity.
async function reserveRefunds(booking, requestedAmount, reason, source, actor, session) {
  let remaining = amount(requestedAmount);
  if (!remaining) return [];
  const payments = await Payment.find({ booking_id: booking.booking_id, payment_status: 'paid' }).sort({ payment_id: 1 }).session(session).lean();
  const created = [];
  for (const payment of payments) {
    const previous = await Refund.find({ payment_id: payment.payment_id, refund_status: { $in: ['pending', 'approved', 'completed'] } }).session(session).lean();
    const capacity = Math.max(0, payment.amount - previous.reduce((sum, item) => sum + item.amount, 0));
    const value = Math.min(capacity, remaining);
    if (!value) continue;
    const refund_id = await repository.nextIds(Refund, 'refund_id', 1, session);
    const [refund] = await Refund.create([{ refund_id, booking_id: booking.booking_id, payment_id: payment.payment_id,
      amount: value, reason, source_key: source, refund_status: 'pending', created_by: actor.user_id, created_at: new Date(),
      history: [event('requested', actor, reason)] }], { session });
    created.push(refund); remaining -= value;
    if (!remaining) break;
  }
  if (remaining) throw new HttpError(409, 'Không đủ giao dịch đã thu để lập hoàn tiền; cần đối soát trước.');
  return created;
}
async function decide(id, input, actor) {
  const reason = text(input.reason);
  if (!['approve', 'reject'].includes(input.decision) || typeof input.requestId !== 'string') throw new HttpError(400, 'Quyết định không hợp lệ');
  return repository.transaction(async (session) => {
    const booking = await repository.booking(id, actor, session);
    const request = booking.cancellation;
    if (!request || request.id !== input.requestId || request.status !== 'pending') throw new HttpError(409, 'Yêu cầu đã thay đổi hoặc được xử lý');
    await assertCancellable(booking, session);
    await reconcilePaid(booking, session);
    if (booking.vehicle_id) await lockVehicleSchedule(booking.vehicle_id, session);
    if (input.decision === 'approve') {
      // Use the policy snapshot from request time; new payments/refunds change the refundable balance.
      const current = cancellationPrice(booking, request.policy ? {
        policy_id: request.policy.policy_id, name: request.policy.name,
        cancellation_fee_percent: request.policy.fee_percent,
      } : null, request.requested_at);
      if (current.refund_amount !== request.refund_amount || current.fee !== request.fee) throw new HttpError(409, 'Số tiền đã thay đổi; cần từ chối và lập lại yêu cầu hủy');
      if (input.feeOverride !== undefined) {
        if (actor.role_name !== 'manager') throw new HttpError(403, 'Chỉ Manager được điều chỉnh phí hủy');
        const override = amount(input.feeOverride);
        if (override > (booking.paid_total || 0) - (booking.refunded_total || 0)) throw new HttpError(400, 'Phí giữ lại không được vượt tiền còn đã thu');
        request.original_fee = request.fee; request.fee = override;
        request.refund_amount = booking.paid_total - (booking.refunded_total || 0) - override;
      } else if (request.fee > (booking.paid_total || 0) - (booking.refunded_total || 0)) {
        throw new HttpError(409, 'Phí hủy vượt tiền đã thu; cần Manager xét ngoại lệ điều chỉnh phí trước khi hủy.');
      }
      await reserveRefunds(booking, request.refund_amount, request.reason, 'cancellation:' + request.id, actor, session);
      booking.booking_status = 'cancelled';
      if (booking.transport_contract) { booking.transport_contract = { ...booking.transport_contract, status: 'cancelled', cancelledAt: new Date() }; }
      booking.checkout_attempt = undefined;
      const assignments = await TripAssignment.find({ booking_id: booking.booking_id, assignment_status: { $in: ['assigned', 'accepted', 'in_progress'] } }).session(session).lean();
      await TripAssignment.updateMany({ booking_id: booking.booking_id, assignment_status: { $in: ['assigned', 'accepted'] } }, { $set: { assignment_status: 'cancelled' } }, { session });
      for (const assignment of assignments) {
        const active = await TripAssignment.exists({ driver_id: assignment.driver_id, assignment_status: { $in: ['assigned', 'accepted', 'in_progress'] } }).session(session);
        if (!active) await DriverProfile.updateOne({ driver_id: assignment.driver_id, availability_status: 'busy' }, { $set: { availability_status: 'available' } }, { session });
      }
      await TripWorkflow.updateOne({ booking_id: booking.booking_id }, { $set: { stage: 'cancelled', updated_at: new Date() },
        $push: { history: { action: 'booking_cancelled', actor_id: actor.user_id, created_at: new Date(), note: reason } } }, { session });
      await BookingChangeRequest.updateMany({ booking_id: booking.booking_id, request_status: 'pending' },
        { $set: { request_status: 'cancelled', reviewed_by: actor.user_id, reviewed_at: new Date(), rejection_reason: 'Booking đã hủy' } }, { session });
    }
    Object.assign(request, { status: input.decision === 'approve' ? 'approved' : 'rejected', reviewed_by: actor.user_id, reviewed_at: new Date(), decision_note: reason });
    notify(booking, 'cancellation_' + request.status, actor, reason);
    await booking.save({ session });
    return request;
  });
}
async function decideRefund(id, input, actor) {
  const reason = text(input.reason);
  if (!['approve', 'reject', 'complete'].includes(input.decision)) throw new HttpError(400, 'Quyết định không hợp lệ');
  return repository.transaction(async (session) => {
    const refund = await Refund.findOne({ refund_id: positiveId(id) }).session(session);
    if (!refund) throw new HttpError(404, 'Không tìm thấy hoàn tiền');
    const expected = input.decision === 'complete' ? 'approved' : 'pending';
    if (refund.refund_status !== expected) throw new HttpError(409, 'Phiếu hoàn tiền đã thay đổi');
    const payment = await Payment.findOne({ payment_id: refund.payment_id }).session(session).lean();
    if (!payment || payment.payment_status !== 'paid') throw new HttpError(409, 'Không có giao dịch đã thu hợp lệ');
    const booking = await repository.booking(payment.booking_id, actor, session);
    refund.refund_status = { approve: 'approved', reject: 'rejected', complete: 'completed' }[input.decision];
    refund.decision_note = reason;
    if (input.decision === 'complete') {
      if (!['simulation', 'promotion'].includes(payment.payment_method)) throw new HttpError(409, 'Chỉ hoàn tiền mô phỏng cho giao dịch demo; không ghi nhận hoàn thật.');
      const completed = await Refund.find({ payment_id: payment.payment_id, refund_status: 'completed' }).session(session).lean();
      if (completed.reduce((sum, item) => sum + item.amount, 0) + refund.amount > payment.amount) throw new HttpError(409, 'Số tiền hoàn vượt số đã thu');
      refund.completed_at = new Date(); refund.provider_reference = 'SIM-REFUND-' + refund.refund_id;
      booking.refunded_total = (booking.refunded_total || 0) + refund.amount;
      if (refund.source_key?.startsWith('incident:')) booking.compensation_refunded = (booking.compensation_refunded || 0) + refund.amount;
    } else { refund.approved_by = actor.user_id; refund.reviewed_at = new Date(); }
    refund.history.push(event(input.decision, actor, reason));
    notify(booking, 'refund_' + refund.refund_status, actor, reason);
    await booking.save({ session }); await refund.save({ session });
    return refund;
  });
}
module.exports = { preview, request, decide, decideRefund, reserveRefunds, cancellationPrice };
