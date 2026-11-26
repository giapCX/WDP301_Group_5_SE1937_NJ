const mongoose = require('mongoose');
const HttpError = require('../utils/http-error');
const { supportsVehicleSeatCount } = require('../config/vehicle.constants');

async function findActive(booking, snapshot) {
  const seat_count = booking.requested_seats ?? booking.requested_seat_count;
  if (!supportsVehicleSeatCount(seat_count)) {
    throw new HttpError(409, 'Booking thiếu số chỗ để xác định bảng giá.');
  }
  const query = { service_type: booking.service_type, seat_count, status: 'active' };
  if (snapshot) {
    if (!Number.isSafeInteger(snapshot.rule_id) || !snapshot.updated_at) {
      throw new HttpError(409, 'Phiên bản bảng giá không hợp lệ; vui lòng tính lại báo giá.');
    }
    query.rule_id = snapshot.rule_id;
    query.updated_at = new Date(snapshot.updated_at);
  }
  const rules = await mongoose.connection.db.collection('pricing_rules').find(query).limit(2).toArray();
  if (rules.length > 1) throw new HttpError(409, 'Có nhiều bảng giá đang hoạt động cho cùng dịch vụ và số chỗ.');
  if (!rules[0]) throw new HttpError(409, 'Chưa có bảng giá đang hoạt động cho dịch vụ và số chỗ này.');
  return rules[0];
}

module.exports = { findActive };
