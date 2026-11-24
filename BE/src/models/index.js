const BookingChangeRequest = require('./booking-change-request.model');
const Role = require('./role.model');
const User = require('./user.model');
const DriverProfile = require('./driver-profile.model');
const Vehicle = require('./vehicle.model');
const Booking = require('./booking.model');
const TripStop = require('./trip-stop.model');
const TripAssignment = require('./trip-assignment.model');
const TripStatusUpdate = require('./trip-status-update.model');
const Promotion = require('./promotion.model');
const BookingPromotion = require('./booking-promotion.model');
const Payment = require('./payment.model');
const Refund = require('./refund.model');
const VehicleInspection = require('./vehicle-inspection.model');
const MaintenanceRecord = require('./maintenance-record.model');
const Incident = require('./incident.model');
const Review = require('./review.model');
const TripWorkflow = require('./trip-workflow.model');
const VehicleHandover = require('./vehicle-handover.model');
const VehicleDamage = require('./vehicle-damage.model');

module.exports = {
  BookingChangeRequest,
  Role,
  User,
  DriverProfile,
  Vehicle,
  Booking,
  TripStop,
  TripAssignment,
  TripStatusUpdate,
  Promotion,
  BookingPromotion,
  Payment,
  Refund,
  VehicleInspection,
  MaintenanceRecord,
  Incident,
  Review,
  TripWorkflow,
  VehicleHandover,
  VehicleDamage,
};
