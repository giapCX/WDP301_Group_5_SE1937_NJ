const { randomUUID } = require('node:crypto');
const { Booking, Promotion, BookingPromotion } = require('../models');
const { runInTransaction, lockVehicleSchedule } = require('../repositories/booking.repository');
const { findAssignableVehicle } = require('../repositories/renter-reservation.repository');
const HttpError = require('../utils/http-error');

const { calculateQuote } = require('./quote-calculator');

const TERMS_VERSION = 'renter-reservation-v1';

function readAmount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new HttpError(400, label + ' không hợp lệ.');
  }
  return value;
}

async function findVehicle(booking, session) {
  if (+booking.pickup_time <= Date.now()) throw new HttpError(409, 'Giờ khởi hành của yêu cầu đã qua.');
  const vehicle = await findAssignableVehicle({
    bookingId: booking.booking_id, pickupTime: booking.pickup_time,
    estimatedEndTime: booking.estimated_end_time, minSeats: booking.requested_seats, session,
  });
  if (!vehicle) throw new HttpError(409, 'Không còn xe đủ chỗ trong khung giờ yêu cầu.');
  return vehicle;
}

async function previewQuote(bookingId, input) {
  const booking = await Booking.findOne({ booking_id: bookingId }).lean();
  if (!booking) throw new HttpError(404, 'Không tìm thấy booking.');
  if (!booking.quote_requested_at || !['pending', 'quoted'].includes(booking.booking_status)) {
    throw new HttpError(409, 'Booking không ở bước xem xét báo giá.');
  }
  return calculateQuote(booking.service_type, input?.calculation);
}

async function sendQuote(bookingId, input, operatorId) {
  const booking = await Booking.findOne({ booking_id: bookingId }).lean();
  if (!booking) throw new HttpError(404, 'Không tìm thấy booking.');
  if (!booking.quote_requested_at || !['pending', 'quoted'].includes(booking.booking_status)) {
    throw new HttpError(409, 'Booking không ở bước gửi báo giá.');
  }

  if (booking.cancellation?.status === 'pending') throw new HttpError(409, 'Đơn đang chờ xử lý hủy');
  const calculation = calculateQuote(booking.service_type, input?.calculation);
  const subtotal = calculation.subtotal;
  const transportContract = await require('./passenger-contract.service').proposal(input?.contract, booking, operatorId);
  transportContract.stops = await require('../models').TripStop.find({ booking_id: bookingId }).sort({ stop_order: 1 }).select('location arrival_at departure_at -_id').lean();
  const deposit = readAmount(input?.deposit, 'Tiền đặt cọc');
  await findVehicle(booking, null);
  if (!(await require('../repositories/booking-readiness.repository').availableDrivers(booking)).length) throw new HttpError(409, 'Chưa có tài xế đủ điều kiện và còn lịch để phục vụ; cần đề xuất lịch khác.');
  const promotion = booking.requested_promotion_code ? await Promotion.findOne({
    code: booking.requested_promotion_code, status: 'active', valid_until: { $gte: new Date() },
    discount_percent: { $gt: 0, $lte: 100 },
  }).lean() : null;
  const discount = Math.round(subtotal * ((promotion?.discount_percent ?? 0) / 100));
  const total = subtotal - discount;
  if (deposit > total) throw new HttpError(400, 'Tiền đặt cọc không được lớn hơn giá sau ưu đãi.');
  const updated = await Booking.findOneAndUpdate({
    booking_id: bookingId,
    booking_status: booking.booking_status,
    'quote_offer.id': booking.quote_offer?.id ?? { $exists: false },
  }, { $set: {
    booking_status: 'quoted', estimated_price: subtotal, additional_charge: 0,
    pricing_breakdown: { subtotal, surcharge: 0, discount, total },
    quote_calculation: calculation,
    transport_contract: transportContract,
    quote_offer: { id: randomUUID(), sent_by: operatorId, sent_at: new Date(),
      promotion_id: promotion?.promotion_id, promotion_code: promotion?.code },
    deposit_due: deposit,
  } }, { returnDocument: 'after' }).select('-_id -renter_request_id').lean();

  if (!updated) throw new HttpError(409, 'Yêu cầu đã thay đổi. Vui lòng tải lại.');
  return updated;
}

async function acceptQuote(bookingId, renterId, input) {
  if (typeof input?.quoteId !== 'string' || input.termsAccepted !== true) {
    throw new HttpError(400, 'Vui lòng kiểm tra báo giá và đồng ý điều khoản đặt xe.');
  }

  return runInTransaction(async (session) => {
    const booking = await Booking.findOne({ booking_id: bookingId, renter_id: renterId }).session(session).lean();
    if (!booking) throw new HttpError(404, 'Không tìm thấy booking.');
    if (booking.cancellation?.status === 'pending') throw new HttpError(409, 'Đơn đang chờ xử lý hủy');
    if (booking.quote_offer?.id !== input.quoteId) throw new HttpError(409, 'Báo giá đã thay đổi. Vui lòng tải lại.');
    if (booking.quote_offer.accepted_at) return booking.booking_status;
    if (booking.booking_status !== 'quoted') throw new HttpError(409, 'Đơn chưa có báo giá để xác nhận.');

    if (input.contractAccepted !== true) throw new HttpError(400, 'Cần tích xác nhận ký hợp đồng');
    const signed = require('./passenger-contract.service').render(booking, input.renter);
    if (signed.hash !== input.documentHash) throw new HttpError(409, 'Nội dung hợp đồng đã thay đổi; xem lại trước khi ký');
    const vehicle = await findVehicle(booking, session);
    const locked = await lockVehicleSchedule(vehicle.vehicle_id, session);
    if (!locked) throw new HttpError(409, 'Xe vừa thay đổi. Vui lòng thử lại.');
    const now = new Date();
    const status = 'awaiting_payment';
    const update = await Booking.updateOne({
      booking_id: bookingId, renter_id: renterId, booking_status: 'quoted', 'quote_offer.id': input.quoteId,
    }, { $set: {
      booking_status: status, vehicle_id: vehicle.vehicle_id, reviewed_by: booking.quote_offer.sent_by,
      reviewed_at: now, 'quote_offer.accepted_at': now, terms_accepted_at: now, terms_version: TERMS_VERSION,
      paid_total: 0,
      transport_contract: { ...booking.transport_contract, status: 'signed_pending_payment', document: signed.document, hash: signed.hash, signedBy: renterId, signedAt: now, acceptanceMethod: 'checkbox' },
    } }, { session });
    if (!update.modifiedCount) throw new HttpError(409, 'Báo giá đã thay đổi. Vui lòng tải lại.');
    if (booking.quote_offer.promotion_id) await BookingPromotion.create([{
      booking_id: bookingId, promotion_id: booking.quote_offer.promotion_id,
      discount_amount: booking.pricing_breakdown.discount,
    }], { session });
    return status;
  });
}

async function closeTrip(bookingId) {
  const workflow = await require('../models').TripWorkflow.findOne({ booking_id: bookingId }).lean();
  if (workflow && workflow.stage !== 'completed') throw new HttpError(409, 'Driver và Gara cần hoàn tất chuyến và tiếp nhận xe trước.');
  const booking = await Booking.findOneAndUpdate({
    booking_id: bookingId,
    booking_status: { $in: ['confirmed', 'in_progress'] },
    'quote_offer.accepted_at': { $type: 'date' },
    estimated_end_time: { $lte: new Date() },
  }, { $set: { booking_status: 'completed' } }, { returnDocument: 'after' }).select('-_id -renter_request_id').lean();
  if (!booking) throw new HttpError(409, 'Chỉ có thể hoàn tất chuyến đã xác nhận và qua giờ kết thúc.');
  return booking;
}

module.exports = { sendQuote, acceptQuote, closeTrip, previewQuote };

