const HttpError = require('../utils/http-error');

// Reference rates for the project, in VND; operators may change rates explicitly.
const rates = { 4: [10000, 1200000, 80000], 7: [12000, 1500000, 100000],
  16: [15000, 2000000, 150000], 29: [20000, 3000000, 200000], 45: [25000, 4500000, 300000] };

const vietnamDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

function tourRentalDays(booking) {
  const pickup = new Date(booking.pickup_time ?? NaN);
  const end = new Date(booking.estimated_end_time ?? NaN);
  if (!Number.isFinite(+pickup) || !Number.isFinite(+end) || end <= pickup) return null;
  const pickupDay = Date.parse(`${vietnamDate.format(pickup)}T00:00:00Z`);
  const endDay = Date.parse(`${vietnamDate.format(end)}T00:00:00Z`);
  return (endDay - pickupDay) / 86400000 + 1;
}

function calculateQuote(booking, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Thiếu thông số tính giá.');
  const values = {};
  function number(key, label, integer = false) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9 || (integer && !Number.isSafeInteger(value))) {
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
  if (booking.service_type === 'roundtrip') {
    const outward = number('outwardKm', 'Km lượt đi');
    const inward = number('returnKm', 'Km lượt về');
    const kmRate = number('kmRate', 'Đơn giá/km', true);
    if (!outward || !inward || !kmRate) throw new HttpError(400, 'Km hai lượt và đơn giá phải lớn hơn 0.');
    line('Lượt đi', outward, kmRate);
    line('Lượt về', inward, kmRate);
    const percent = number('dispatchPercent', 'Tỷ lệ điều xe');
    if (percent > 100) throw new HttpError(400, 'Tỷ lệ điều xe không vượt quá 100%.');
    line('Điều xe', 1, Math.round((outward + inward) * kmRate * percent / 100));
  } else if (booking.service_type === 'tour') {
    const days = tourRentalDays(booking);
    if (!days) throw new HttpError(400, 'Thời gian thuê trong booking không hợp lệ.');
    values.rentalDays = days;
    const dayRate = number('dayRate', 'Đơn giá/ngày', true);
    if (!dayRate) throw new HttpError(400, 'Đơn giá/ngày phải lớn hơn 0.');
    line('Thuê cơ bản (100 km/ngày)', days, dayRate);
    line('Vượt km', Math.max(0, number('totalKm', 'Tổng km') - days * 100), number('kmRate', 'Đơn giá/km', true));
    const nights = number('nights', 'Số đêm', true);
    if (nights >= days) throw new HttpError(400, `Đã nhập ${nights} đêm cho ${days} ngày thuê. Số đêm tối đa là ${days - 1}.`);
    line('Lưu trú tài xế', nights, number('nightRate', 'Đơn giá lưu trú', true));
  } else throw new HttpError(400, 'Loại dịch vụ không hợp lệ.');
  const subtotal = lines.reduce((sum, item) => sum + item.amount, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) throw new HttpError(400, 'Tổng giá không hợp lệ.');
  return { inputs: values, lines, subtotal };
}

module.exports = { calculateQuote, rates, tourRentalDays };
