const HttpError = require('../utils/http-error');
const { SERVICE_TYPES } = require('../config/pricing.constants');
const QUOTE_LIMITS = Object.freeze({ MAX_INPUT: 1e9, MAX_PERCENT: 100 });
const { VIETNAM_TIME_ZONE, VIETNAM_DATE_LOCALE } = require('../config/time.constants');

const vietnamDate = new Intl.DateTimeFormat(VIETNAM_DATE_LOCALE, { timeZone: VIETNAM_TIME_ZONE });

function tourRentalDays(booking) {
  const pickup = new Date(booking.pickup_time ?? NaN);
  const end = new Date(booking.estimated_end_time ?? NaN);
  if (!Number.isFinite(+pickup) || !Number.isFinite(+end) || end <= pickup) return null;
  const pickupDay = Date.parse(`${vietnamDate.format(pickup)}T00:00:00Z`);
  const endDay = Date.parse(`${vietnamDate.format(end)}T00:00:00Z`);
  return (endDay - pickupDay) / 86400000 + 1;
}

function calculateQuote(booking, input, pricingRule) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Thiếu thông số tính giá.');
  if (!pricingRule || pricingRule.service_type !== booking.service_type ||
      pricingRule.seat_count !== (booking.requested_seats ?? booking.requested_seat_count)) {
    throw new HttpError(409, 'Không tìm thấy bảng giá đang áp dụng cho dịch vụ và số chỗ của booking.');
  }
  const values = {};
  function number(key, label, integer = false) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > QUOTE_LIMITS.MAX_INPUT || (integer && !Number.isSafeInteger(value))) {
      throw new HttpError(400, `${label} không hợp lệ.`);
    }
    values[key] = value;
    return value;
  }
  const lines = [];
  function line(label, quantity, unitPrice) {
    const amount = Math.round(quantity * unitPrice);
    if (!Number.isSafeInteger(amount)) throw new HttpError(400, 'Giá trị tính giá quá lớn.');
    lines.push({ label, quantity, unit_price: unitPrice, amount });
  }
  if (booking.service_type === SERVICE_TYPES.ROUNDTRIP) {
    const outward = number('outwardKm', 'Km lượt đi');
    const inward = number('returnKm', 'Km lượt về');
    const kmRate = pricingRule.km_rate;
    const dispatchPercent = pricingRule.dispatch_percent;
    if (!Number.isSafeInteger(kmRate) || kmRate <= 0 || !Number.isFinite(dispatchPercent) || dispatchPercent < 0 || dispatchPercent > QUOTE_LIMITS.MAX_PERCENT) {
      throw new HttpError(409, 'Bảng giá khứ hồi chưa cấu hình hợp lệ.');
    }
    if (!outward || !inward || !kmRate) throw new HttpError(400, 'Km hai lượt và đơn giá phải lớn hơn 0.');
    line('Lượt đi', outward, kmRate);
    line('Lượt về', inward, kmRate);
    line('Điều xe', 1, Math.round((outward + inward) * kmRate * dispatchPercent / QUOTE_LIMITS.MAX_PERCENT));
  } else if (booking.service_type === SERVICE_TYPES.TOUR) {
    const days = tourRentalDays(booking);
    if (!days) throw new HttpError(400, 'Thời gian thuê trong booking không hợp lệ.');
    values.rentalDays = days;
    const dayRate = pricingRule.day_rate;
    const includedKm = pricingRule.included_km_per_day;
    const extraKmRate = pricingRule.extra_km_rate;
    const driverNightRate = pricingRule.driver_night_rate;
    if (!Number.isSafeInteger(dayRate) || dayRate <= 0 || !Number.isSafeInteger(includedKm) || includedKm < 0 ||
        !Number.isSafeInteger(extraKmRate) || extraKmRate < 0 || !Number.isSafeInteger(driverNightRate) || driverNightRate < 0) {
      throw new HttpError(409, 'Bảng giá tour chưa cấu hình hợp lệ.');
    }
    line('Thuê cơ bản', days, dayRate);
    line('Vượt km', Math.max(0, number('totalKm', 'Tổng km') - days * includedKm), extraKmRate);
    const nights = number('nights', 'Số đêm', true);
    if (nights >= days) throw new HttpError(400, `Đã nhập ${nights} đêm cho ${days} ngày thuê. Số đêm tối đa là ${days - 1}.`);
    line('Lưu trú tài xế', nights, driverNightRate);
  } else throw new HttpError(400, 'Loại dịch vụ không hợp lệ.');
  const subtotal = lines.reduce((sum, item) => sum + item.amount, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) throw new HttpError(400, 'Tổng giá không hợp lệ.');
  const { rule_id, name, service_type, seat_count, updated_at } = pricingRule;
  return { inputs: values, lines, subtotal,
    pricing_rule: { rule_id, name, service_type, seat_count, updated_at,
      km_rate: pricingRule.km_rate, dispatch_percent: pricingRule.dispatch_percent,
      day_rate: pricingRule.day_rate, included_km_per_day: pricingRule.included_km_per_day,
      extra_km_rate: pricingRule.extra_km_rate, driver_night_rate: pricingRule.driver_night_rate } };
}

module.exports = { calculateQuote, tourRentalDays };
