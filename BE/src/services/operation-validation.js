const HttpError = require('../utils/http-error');
function text(value, label = 'Lý do') {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000) throw new HttpError(400, label + ' cần từ 1 đến 2000 ký tự');
  return value.trim();
}
function amount(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1e12) throw new HttpError(400, 'Số tiền không hợp lệ');
  return value;
}
function evidence(value = []) {
  if (!Array.isArray(value) || value.length > 10 || value.some((item) => {
    try { const url = new URL(item); return typeof item !== 'string' || item.length > 1000 || url.protocol !== 'https:' || url.username || url.password; } catch { return true; }
  })) throw new HttpError(400, 'Bằng chứng phải là tối đa 10 URL HTTPS hợp lệ');
  return value;
}
function event(action, actor, note) { return { action, actor_id: actor.user_id, at: new Date(), note: note?.slice(0, 2000) }; }
function notify(booking, action, actor, note) { booking.operation_events.push(event(action, actor, note)); }
module.exports = { text, amount, evidence, event, notify };
