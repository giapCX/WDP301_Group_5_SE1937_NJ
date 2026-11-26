const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');
const { Booking, Payment } = require('../models');
const { runInTransaction } = require('../repositories/booking.repository');
const { nextIds } = require('../repositories/renter-reservation.repository');
const HttpError = require('../utils/http-error');

const CURRENCY = 'vnd';
const CHECKOUT_LIFETIME_SECONDS = 60 * 60;

function clientOrigin() {
  return process.env.CLIENT_ORIGIN?.split(',')[0].trim();
}

function isSimulated() {
  return process.env.NODE_ENV !== 'production' && process.env.PAYMENT_MODE !== 'stripe';
}

function isAvailable() {
  if (isSimulated()) return true;
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && clientOrigin());
}

function paymentDue(booking) {
  if (booking.transport_contract?.status === 'cancelled') return null;
  const price = booking.pricing_breakdown;
  if (!price || !Number.isSafeInteger(price.total) || booking.additional_charges?.some((charge) => charge.status === 'disputed')) return null;
  if (booking.booking_status === 'awaiting_payment') {
    return booking.quote_offer?.accepted_at
      ? { purpose: 'deposit', amount: booking.deposit_due }
      : { purpose: 'full', amount: price.total };
  }
  if (booking.booking_status === 'completed' && booking.quote_offer?.accepted_at) {
    const amount = price.total + (booking.additional_charge ?? 0) - (price.surcharge ?? 0) - (booking.paid_total ?? 0) + (booking.refunded_total ?? 0) - (booking.compensation_refunded ?? 0);
    if (Number.isSafeInteger(amount) && amount > 0) return { purpose: 'balance', amount };
  }
  return null;
}

async function stripe(path, options = {}) {
  if (!isAvailable()) throw new HttpError(503, 'Thanh toán trực tuyến chưa được cấu hình.');
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions' + path, {
      ...options,
      headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, ...options.headers },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Stripe rejected request');
    return await response.json();
  } catch {
    throw new HttpError(502, 'Cổng thanh toán chưa phản hồi. Vui lòng thử lại.');
  }
}

function contractCancellation(booking, reason, at) {
  const awaitingPayment = booking.booking_status === 'awaiting_payment' && booking.transport_contract?.status === 'signed_pending_payment';
  const cancellingBalance = reason === 'payment_cancelled' && booking.booking_status === 'completed' && booking.transport_contract?.status === 'active';
  if (!awaitingPayment && !cancellingBalance) return null;
  return {
    ...(awaitingPayment && { booking_status: 'cancelled' }),
    'transport_contract.status': 'cancelled',
    'transport_contract.cancelledAt': at,
    'transport_contract.cancellationReason': reason,
  };
}

async function recordPayment({ bookingId, attemptId, amount, reference, method, paid = true }) {
  if (!Number.isSafeInteger(bookingId) || bookingId < 1) return false;
  return runInTransaction(async (session) => {
    const booking = await Booking.findOne({ booking_id: bookingId }).session(session).lean();
    if (!booking || booking.checkout_attempt?.id !== attemptId) return false;
    const attempt = booking.checkout_attempt;
    const due = paymentDue(booking);
    const purpose = attempt.purpose ?? due?.purpose;
    const status = purpose === 'balance' ? 'completed' : 'awaiting_payment';
    if (!purpose || booking.booking_status !== status || (attempt.amount ?? due?.amount) !== amount) return false;
    if (paid && purpose !== 'balance' && booking.transport_contract && booking.transport_contract.status !== 'signed_pending_payment') return false;
    const now = new Date();
    const update = paid ? {
      $inc: { paid_total: amount },
      $unset: { checkout_attempt: '', checkout_failed_at: '' },
      ...(purpose !== 'balance' && { $set: {
        booking_status: 'confirmed', ...(booking.transport_contract && { 'transport_contract.status': 'active', 'transport_contract.activatedAt': new Date(), 'transport_contract.paymentReference': reference }), ...(purpose === 'deposit' && { deposit_paid_at: new Date() }),
      } }),
    } : { $set: { checkout_failed_at: now }, $unset: { checkout_attempt: '' } };
    const updated = await Booking.updateOne(
      { booking_id: bookingId, booking_status: booking.booking_status, 'checkout_attempt.id': attemptId },
      update, { session },
    );
    if (!updated.modifiedCount) return false;
    const paymentId = await nextIds(Payment, 'payment_id', 1, session);
    await Payment.create([{
      payment_id: paymentId, booking_id: bookingId, payment_status: paid ? 'paid' : 'failed', payment_method: method,
      provider_reference: reference, amount, purpose, paid_at: paid ? new Date() : null,
    }], { session });
    return true;
  });
}

async function checkout(bookingId, renterId) {
  const filter = { booking_id: bookingId, renter_id: renterId };
  const booking = await Booking.findOne(filter).lean();
  if (!booking) throw new HttpError(404, 'Không tìm thấy đơn đặt xe.');
  if (booking.cancellation?.status === 'pending') throw new HttpError(409, 'Đơn đang chờ Operator xử lý hủy');
  if (booking.transport_contract && booking.transport_contract.status === 'proposed') throw new HttpError(409, 'Cần ký hợp đồng trước khi thanh toán');
  if (booking.transport_contract?.status === 'cancelled') throw new HttpError(409, 'Hợp đồng đã bị hủy và không thể thanh toán.');
  const due = paymentDue(booking);
  if (!due) throw new HttpError(409, 'Đơn chưa đến bước thanh toán.');
  const amount = booking.checkout_attempt?.amount ?? due.amount;
  if (!Number.isSafeInteger(amount) || amount < 0) throw new HttpError(409, 'Số tiền thanh toán không hợp lệ.');

  if (amount > 0 && !isAvailable()) {
    throw new HttpError(503, 'Thanh toán trực tuyến chưa được cấu hình.');
  }

  const attempt = { id: randomUUID(), amount, purpose: due.purpose,
    expiresAt: Math.floor(Date.now() / 1000) + CHECKOUT_LIFETIME_SECONDS };
  const payable = { ...filter, booking_status: booking.booking_status, paid_total: booking.paid_total ?? { $exists: false } };
  const initialized = await Booking.findOneAndUpdate(
    { ...payable, 'checkout_attempt.id': { $exists: false } },
    { $set: { checkout_attempt: attempt } }, { returnDocument: 'after' },
  ).lean();
  const current = initialized || await Booking.findOne(payable).lean();
  if (!current?.checkout_attempt) throw new HttpError(409, 'Đơn đã được xử lý, vui lòng tải lại.');
  const active = current.checkout_attempt;

  if (isSimulated()) {
    if (active.amount !== due.amount || active.purpose !== due.purpose) {
      await Booking.updateOne({ ...filter, 'checkout_attempt.id': active.id }, { $unset: { checkout_attempt: '' } });
      throw new HttpError(409, 'Chi phí đã thay đổi; vui lòng mở lại thanh toán để xem số tiền mới.');
    }
    return { simulated: true, attemptId: active.id, amount: active.amount, purpose: active.purpose };
  }

  if (amount === 0) {
    await recordPayment({ bookingId, attemptId: active.id, amount, reference: active.id, method: 'no_payment_due' });
    return { confirmed: true };
  }

  if (active.sessionId) {
    const existing = await stripe('/' + encodeURIComponent(active.sessionId));
    if (existing.payment_status === 'paid') {
      await fulfill(existing);
      return { confirmed: true };
    }
    if (existing.status === 'expired') {
      await Booking.updateOne({ ...filter, 'checkout_attempt.id': active.id }, { $unset: { checkout_attempt: '' } });
      throw new HttpError(409, 'Phiên thanh toán đã hết hạn. Vui lòng thử lại.');
    }
    if (existing.status === 'open' && existing.url) return { url: existing.url };
    throw new HttpError(409, 'Giao dịch đang được xác minh.');
  }

  const returnUrl = new URL('/renter/bookings', clientOrigin());
  returnUrl.searchParams.set('booking', bookingId);
  const body = new URLSearchParams({
    mode: 'payment',
    success_url: returnUrl.toString() + '&checkout=complete',
    cancel_url: returnUrl.toString() + '&checkout=cancelled',
    expires_at: String(active.expiresAt),
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': CURRENCY,
    'line_items[0][price_data][unit_amount]': String(active.amount ?? amount),
    'line_items[0][price_data][product_data][name]': 'VietTour #' + bookingId,
    'metadata[booking_id]': String(bookingId),
    'metadata[attempt_id]': active.id,
  });
  // Recover a session even if the previous request timed out before its ID was saved.
  const external = await stripe('', { method: 'POST', body, headers: { 'Idempotency-Key': active.id } });
  await Booking.updateOne(
    { ...filter, 'checkout_attempt.id': active.id },
    { $set: { 'checkout_attempt.sessionId': external.id } },
  );
  if (external.payment_status === 'paid') {
    await fulfill(external);
    return { confirmed: true };
  }
  if (!external.url) throw new HttpError(409, 'Phiên thanh toán đang được xử lý. Vui lòng thử lại.');
  return { url: external.url };
}

async function simulate(bookingId, renterId, input) {
  if (!isSimulated()) throw new HttpError(404, 'Thanh toán mô phỏng không khả dụng.');
  if (!input || typeof input.attemptId !== 'string' || !['success', 'failed', 'cancelled'].includes(input.outcome)) {
    throw new HttpError(400, 'Kết quả mô phỏng không hợp lệ.');
  }
  const filter = { booking_id: bookingId, renter_id: renterId, 'checkout_attempt.id': input.attemptId };
  const booking = await Booking.findOne(filter).lean();
  if (!booking) throw new HttpError(409, 'Phiên thanh toán đã thay đổi hoặc đã xử lý.');
  const currentDue = paymentDue(booking);
  if (!currentDue) throw new HttpError(409, 'Đơn chưa đến bước thanh toán.');
  if (input.outcome !== 'cancelled' && (currentDue.amount !== booking.checkout_attempt.amount || currentDue.purpose !== booking.checkout_attempt.purpose)) throw new HttpError(409, 'Chi phí đã thay đổi. Vui lòng tải lại và mở lại thanh toán.');
  const cancellation = input.outcome === 'cancelled'
    ? contractCancellation(booking, 'payment_cancelled', new Date())
    : null;
  if (input.outcome === 'cancelled') {
    const result = await Booking.updateOne({ ...filter, booking_status: booking.booking_status }, {
      ...(cancellation && { $set: cancellation }), $unset: { checkout_attempt: '' },
    });
    if (!result.modifiedCount) throw new HttpError(409, 'Phiên thanh toán đã được xử lý.');
  } else {
    const saved = await recordPayment({ bookingId, attemptId: input.attemptId,
      amount: booking.checkout_attempt.amount, reference: 'SIM-' + input.attemptId,
      method: 'simulation', paid: input.outcome === 'success' });
    if (!saved) throw new HttpError(409, 'Phiên thanh toán đã được xử lý.');
  }
  return { simulated: true, outcome: input.outcome, contractCancelled: Boolean(cancellation) };
}

async function fulfill(checkoutSession, paid = true) {
  if ((paid && checkoutSession.payment_status !== 'paid') || checkoutSession.currency !== CURRENCY ||
      checkoutSession.mode !== 'payment' || !checkoutSession.metadata?.attempt_id) return;
  await recordPayment({
    bookingId: Number(checkoutSession.metadata.booking_id),
    attemptId: checkoutSession.metadata.attempt_id,
    amount: checkoutSession.amount_total,
    reference: checkoutSession.id,
    method: checkoutSession.payment_method_types?.length === 1 ? checkoutSession.payment_method_types[0] : 'stripe_checkout',
    paid,
  });
}

function verifyWebhook(body, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !Buffer.isBuffer(body)) throw new HttpError(400, 'Yêu cầu thanh toán không hợp lệ.');
  const fields = (signature || '').split(',').map((part) => part.split('='));
  const timestamp = fields.find(([key]) => key === 't')?.[1];
  if (!/^\d+$/.test(timestamp || '') || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new HttpError(400, 'Chữ ký thanh toán đã hết hạn hoặc không hợp lệ.');
  }
  const expected = createHmac('sha256', secret).update(timestamp + '.').update(body).digest();
  if (!fields.some(([key, value]) => key === 'v1' && /^[a-f0-9]{64}$/i.test(value || '') &&
      timingSafeEqual(expected, Buffer.from(value, 'hex')))) {
    throw new HttpError(400, 'Chữ ký thanh toán không hợp lệ.');
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, 'Dữ liệu thanh toán không hợp lệ.');
  }
}

async function webhook(req, res) {
  const event = verifyWebhook(req.body, req.get('Stripe-Signature'));
  const checkoutSession = event?.data?.object;
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event?.type) && checkoutSession) {
    await fulfill(checkoutSession);
  }
  if (event?.type === 'checkout.session.async_payment_failed' && checkoutSession) await fulfill(checkoutSession, false);
  if (event?.type === 'checkout.session.expired' && checkoutSession?.metadata?.attempt_id) {
    await Booking.updateOne(
      { booking_id: Number(checkoutSession.metadata.booking_id), 'checkout_attempt.id': checkoutSession.metadata.attempt_id },
      { $unset: { checkout_attempt: '' } },
    );
  }
  res.sendStatus(204);
}

module.exports = { checkout, isAvailable, isSimulated, simulate, paymentDue, webhook };

