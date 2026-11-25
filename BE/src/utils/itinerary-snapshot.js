function snapshot(booking) {
  const result = {
    pickup_location: booking.pickup_location, dropoff_location: booking.dropoff_location,
    pickup_time: new Date(booking.pickup_time), estimated_end_time: new Date(booking.estimated_end_time),
    estimated_price: booking.estimated_price,
    trip_stops: [...booking.trip_stops].sort((a, b) => a.stop_order - b.stop_order).map((stop) => {
      const value = { stop_order: stop.stop_order, location: stop.location, note: stop.note ?? null };
      for (const key of ['arrival_at', 'departure_at']) if (stop[key]) value[key] = new Date(stop[key]);
      return value;
    }),
  };
  for (const key of ['destination', 'return_pickup_location']) if (booking[key] != null) result[key] = booking[key];
  if (booking.return_pickup_time) result.return_pickup_time = new Date(booking.return_pickup_time);
  return result;
}
function validateTimes(value, type) {
  const HttpError = require('./http-error');
  const start = +value.pickup_time, end = +value.estimated_end_time;
  if (type === 'roundtrip' && (!value.return_pickup_time || +new Date(value.return_pickup_time) <= start || +new Date(value.return_pickup_time) >= end || !value.return_pickup_location?.trim() || !value.destination?.trim())) throw new HttpError(400, 'Thiếu điểm đến/đón về hoặc giờ đón về không hợp lệ');
  if (type === 'tour') {
    if (!value.trip_stops.length || value.trip_stops.length > 20) throw new HttpError(400, 'Tour cần từ 1 đến 20 điểm dừng');
    let previous = start;
    for (const stop of [...value.trip_stops].sort((a, b) => a.stop_order - b.stop_order)) {
      const arrival = +new Date(stop.arrival_at), departure = +new Date(stop.departure_at);
      if (!Number.isFinite(arrival) || !Number.isFinite(departure) || arrival < previous || departure <= arrival || departure > end) throw new HttpError(400, 'Giờ đến/rời điểm tham quan không hợp lệ');
      previous = departure;
    }
  }
}
async function validateActiveChange(booking, after, session) {
  if (booking.booking_status !== 'in_progress') return;
  const { TripWorkflow } = require('../models');
  const workflow = await TripWorkflow.findOne({ booking_id: booking.booking_id, stage: 'routed_to_booking_changes' }).session(session).lean();
  const HttpError = require('./http-error');
  if (!workflow) throw new HttpError(409, 'Driver cần chuyển yêu cầu đổi lịch trong chuyến sang Operator trước.');
  if (+new Date(after.pickup_time) !== +new Date(booking.pickup_time) || after.pickup_location !== booking.pickup_location || +new Date(after.estimated_end_time) <= Date.now()) throw new HttpError(400, 'Không đổi giờ/điểm đón đã thực hiện; giờ kết thúc mới phải ở tương lai');
  const stamp = (value) => value ? +new Date(value) : null;
  for (const stop of booking.trip_stops.filter((item) => workflow.completed_stops.includes(item.stop_id))) {
    const next = after.trip_stops.find((item) => item.stop_order === stop.stop_order);
    if (!next || next.location !== stop.location || stamp(next.arrival_at) !== stamp(stop.arrival_at) || stamp(next.departure_at) !== stamp(stop.departure_at)) throw new HttpError(409, 'Không được thay đổi hoặc xóa điểm tham quan đã hoàn thành');
  }
  if (workflow.leg === 'return' && (+new Date(after.return_pickup_time) !== +new Date(booking.return_pickup_time) || after.return_pickup_location !== booking.return_pickup_location)) throw new HttpError(409, 'Không thay đổi lượt đón về đã thực hiện');
}
module.exports = { snapshot, validateTimes, validateActiveChange };
