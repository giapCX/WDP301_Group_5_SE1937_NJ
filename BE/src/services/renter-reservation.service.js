const { Booking, TripStop } = require('../models');
const bookingRepository = require('../repositories/booking.repository');
const reservationRepository = require('../repositories/renter-reservation.repository');
const HttpError = require('../utils/http-error');
const { supportsVehicleSeatCount, SUPPORTED_VEHICLE_SEAT_COUNTS } = require('../config/vehicle.constants');

function positiveId(value) {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Mã định danh không hợp lệ.');
  return id;
}

function readText(value, label, max = 255, optional = false) {
  if (optional && (value == null || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, label + ' không hợp lệ.');
  }
  return value.trim();
}

function readTime(value) {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new HttpError(400, 'Ngày giờ chuyến đi không hợp lệ.');
  }
  return new Date(value);
}

function readTrip(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'Thông tin chuyến đi không hợp lệ.');
  }
  const { serviceType, stops = [] } = input;
  if (!['roundtrip', 'tour'].includes(serviceType)) throw new HttpError(400, 'Vui lòng chọn loại dịch vụ.');
  const pickupTime = readTime(input.pickupTime);
  const returnTime = readTime(input.endTime);
  const endTime = serviceType === 'roundtrip' ? readTime(input.finalTime) : returnTime;
  if (pickupTime <= new Date() || returnTime <= pickupTime || endTime < returnTime) {
    throw new HttpError(400, 'Giờ kết thúc phải sau giờ đi và giờ đi phải ở tương lai.');
  }
  if (!Array.isArray(stops) || (serviceType === 'tour' && (stops.length < 1 || stops.length > 20))) {
    throw new HttpError(400, 'Vui lòng nhập từ 1 đến 20 điểm tham quan.');
  }
  let previous = pickupTime;
  const itinerary = serviceType === 'tour' ? stops.map((stop, index) => {
    const arrival = readTime(stop?.arrival);
    const departure = readTime(stop?.departure);
    const label = `Điểm ${index + 1}`;
    if (arrival < pickupTime || arrival > endTime || departure > endTime) {
      throw new HttpError(400, `${label}: Giờ đến và giờ rời phải nằm trong thời gian chuyến đi.`);
    }
    if (departure <= arrival) {
      throw new HttpError(400, `${label}: Giờ rời phải sau giờ đến. Nếu rời lúc 00:00 sau một buổi tối, hãy chọn ngày hôm sau.`);
    }
    if (arrival < previous) {
      throw new HttpError(400, `${label}: Giờ đến không được trước giờ rời điểm trước đó.`);
    }
    previous = departure;
    return { location: readText(stop.location, 'Điểm tham quan'), arrival_at: arrival, departure_at: departure };
  }) : [];
  const requestedSeats = positiveId(input.requestedSeats);
  if (!supportsVehicleSeatCount(requestedSeats)) {
    throw new HttpError(400, `Only ${SUPPORTED_VEHICLE_SEAT_COUNTS.join(', ')}-seat vehicle classes are available.`);
  }
  const passengerCount = positiveId(input.passengerCount);
  if (passengerCount > requestedSeats) throw new HttpError(400, 'Số hành khách không được vượt quá số chỗ yêu cầu.');
  return {
    serviceType, pickupTime, endTime, returnTime, itinerary,
    requestedSeats, passengerCount,
    pickup: readText(input.pickup, 'Điểm đón'),
    destination: readText(input.destination, 'Điểm đến'),
    dropoff: readText(input.dropoff, 'Điểm trả cuối'),
    returnPickup: serviceType === 'roundtrip' ? readText(input.returnPickup, 'Điểm đón về') : '',
    notes: readText(input.notes, 'Yêu cầu bổ sung', 1000, true),
  };
}

async function create(input, renterId) {
  const requestId = input?.requestId;
  if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) {
    throw new HttpError(400, 'Yêu cầu báo giá không hợp lệ.');
  }
  const alreadyCreated = { renter_id: renterId, renter_request_id: requestId };
  const existing = await Booking.findOne(alreadyCreated).lean();
  if (existing) return existing;
  const trip = readTrip(input);
  return bookingRepository.runInTransaction(async (session) => {
    const duplicate = await Booking.findOne(alreadyCreated).session(session).lean();
    if (duplicate) return duplicate;
    const bookingId = await reservationRepository.nextIds(Booking, 'booking_id', 1, session);
    const [booking] = await Booking.create([{
      booking_id: bookingId, renter_id: renterId, requested_seats: trip.requestedSeats, service_type: trip.serviceType,
      passenger_count: trip.passengerCount, pickup_location: trip.pickup, destination: trip.destination,
      return_pickup_location: trip.returnPickup, dropoff_location: trip.dropoff, special_requests: trip.notes,
      pickup_time: trip.pickupTime, estimated_end_time: trip.endTime,
      return_pickup_time: trip.serviceType === 'roundtrip' ? trip.returnTime : undefined,
      renter_request_id: requestId, booking_status: 'pending', quote_requested_at: new Date(), created_at: new Date(),
    }], { session });
    const stops = trip.serviceType === 'tour' ? trip.itinerary : [
      { location: trip.destination }, { location: trip.returnPickup, departure_at: trip.returnTime },
    ];
    const firstStop = await reservationRepository.nextIds(TripStop, 'stop_id', stops.length, session);
    await TripStop.insertMany(stops.map((stop, index) => ({
      ...stop, booking_id: bookingId, stop_id: firstStop + index, stop_order: index + 1,
    })), { session });
    return booking;
  });
}

module.exports = { create, positiveId };

