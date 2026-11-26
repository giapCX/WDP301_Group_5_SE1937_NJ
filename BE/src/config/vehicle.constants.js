const SUPPORTED_VEHICLE_SEAT_COUNTS = Object.freeze([7, 9, 16, 29]);

function supportsVehicleSeatCount(value) {
  return SUPPORTED_VEHICLE_SEAT_COUNTS.includes(Number(value));
}

function supportedSeatCountsAtLeast(minimum) {
  return SUPPORTED_VEHICLE_SEAT_COUNTS.filter((seatCount) => seatCount >= minimum);
}

module.exports = { SUPPORTED_VEHICLE_SEAT_COUNTS, supportsVehicleSeatCount, supportedSeatCountsAtLeast };
