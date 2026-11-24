const HttpError = require('../utils/http-error');

// Reference rates for the project, in VND; operators may change rates explicitly.
const rates = { 4: [10000, 1200000, 80000], 7: [12000, 1500000, 100000],
  16: [15000, 2000000, 150000], 29: [20000, 3000000, 200000], 45: [25000, 4500000, 300000] };

function calculateQuote(service, input) {
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
  if (service === 'roundtrip') {
    const outward = number('outwardKm', 'Km lượt đi');
    const inward = number('returnKm', 'Km lượt về');
    const kmRate = number('kmRate', 'Đơn giá/km', true);
    if (!outward || !inward || !kmRate) throw new HttpError(400, 'Km hai lượt và đơn giá phải lớn hơn 0.');
    line('Lượt đi', outward, kmRate);
    line('Lượt về', inward, kmRate);
    const percent = number('dispatchPercent', 'Tỷ lệ điều xe');
    if (percent > 100) throw new HttpError(400, 'Tỷ lệ điều xe không vượt quá 100%.');
    line('Điều xe', 1, Math.round((outward + inward) * kmRate * percent / 100));
  } else if (service === 'tour') {
    if (!Array.isArray(input.dailyHours) || !input.dailyHours.length || input.dailyHours.length > 60 ||
      input.dailyHours.some((hours) => typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0 || hours > 24)) {
      throw new HttpError(400, 'Nhập giờ phục vụ từng ngày từ 0 đến 24 giờ (tối đa 60 ngày).');
    }
    values.dailyHours = input.dailyHours;
    const days = input.dailyHours.length;
    const dayRate = number('dayRate', 'Đơn giá/ngày', true);
    if (!dayRate) throw new HttpError(400, 'Đơn giá/ngày phải lớn hơn 0.');
    line('Thuê cơ bản (8 giờ, 100 km/ngày)', days, dayRate);
    line('Vượt km', Math.max(0, number('totalKm', 'Tổng km') - days * 100), number('kmRate', 'Đơn giá/km', true));
    line('Quá giờ', input.dailyHours.reduce((sum, hours) => sum + Math.max(0, hours - 8), 0), number('hourRate', 'Đơn giá quá giờ', true));
    const nights = number('nights', 'Số đêm', true);
    if (nights >= days) throw new HttpError(400, 'Số đêm phải nhỏ hơn số ngày phục vụ.');
    line('Lưu trú tài xế', nights, number('nightRate', 'Đơn giá lưu trú', true));
  } else throw new HttpError(400, 'Loại dịch vụ không hợp lệ.');
  line('Cầu đường', 1, number('tolls', 'Phí cầu đường', true));
  line('Đỗ xe', 1, number('parking', 'Phí đỗ xe', true));
  line('Phụ phí khác', 1, number('otherFee', 'Phụ phí khác', true));
  const adjustment = input.adjustment;
  if (!Number.isSafeInteger(adjustment) || Math.abs(adjustment) > 1e9) throw new HttpError(400, 'Điều chỉnh giá không hợp lệ.');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length > 1000 || ((adjustment || values.otherFee) && !reason)) throw new HttpError(400, 'Cần ghi lý do điều chỉnh hoặc phụ phí khác (tối đa 1000 ký tự).');
  values.adjustment = adjustment;
  values.reason = reason;
  line('Điều chỉnh', 1, adjustment);
  const subtotal = lines.reduce((sum, item) => sum + item.amount, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) throw new HttpError(400, 'Tổng giá không hợp lệ.');
  return { inputs: values, lines, subtotal };
}

module.exports = { calculateQuote, rates };
