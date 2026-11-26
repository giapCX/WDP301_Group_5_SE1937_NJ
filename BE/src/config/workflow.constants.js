const BOOKING_STATUSES = Object.freeze(['pending', 'quoted', 'awaiting_payment', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected']);
const PAYMENT_STATUSES = Object.freeze(['pending', 'unpaid', 'processing', 'paid', 'failed', 'cancelled', 'refunded', 'completed']);
const REFUND_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'completed']);
const INCIDENT_STATUSES = Object.freeze(['open', 'resolved']);
const MAINTENANCE_STATUSES = Object.freeze(['pending', 'in_progress', 'completed', 'closed', 'cancelled']);
const CONFIGURATION_STATUSES = Object.freeze({ DRAFT: 'draft', ACTIVE: 'active', INACTIVE: 'inactive' });
const USER_STATUS = Object.freeze({ ACTIVE: 'active', LOCKED: 'locked', INACTIVE: 'inactive' });
const USER_STATUSES = Object.freeze(Object.values(USER_STATUS));
const VEHICLE_STATUS = Object.freeze({ PENDING: 'pending', AVAILABLE: 'available', IN_USE: 'in_use', MAINTENANCE: 'maintenance', WITHDRAWN: 'withdrawn' });
const VEHICLE_STATUSES = Object.freeze(Object.values(VEHICLE_STATUS));
const DRIVER_AVAILABILITY_STATUS = Object.freeze({ AVAILABLE: 'available', BUSY: 'busy', UNAVAILABLE: 'unavailable' });
const DRIVER_AVAILABILITY_STATUSES = Object.freeze(Object.values(DRIVER_AVAILABILITY_STATUS));
const APPROVAL_STATUSES = Object.freeze({ PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', EXPIRED: 'expired' });
const ASSIGNMENT_STATUSES = Object.freeze(['assigned', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled']);
const CANCELLATION_STATUSES = Object.freeze(['pending', 'approved', 'rejected']);
const HANDOVER_STATUSES = Object.freeze(['pending', 'accepted', 'declined']);
const TRIP_WORKFLOW_STAGES = Object.freeze(['awaiting_driver', 'awaiting_vehicle', 'to_pickup', 'at_pickup', 'outbound', 'tour',
  'return_waiting', 'return', 'awaiting_report', 'awaiting_vehicle_return', 'vehicle_return_issue', 'vehicle_replacement_required',
  'reassignment_required', 'return_reassignment_required', 'incident_open', 'routed_to_booking_changes', 'completed', 'cancelled']);
const DRIVER_RESPONSES = Object.freeze(['pending', 'accepted', 'rejected']);
const TRIP_LEGS = Object.freeze(['outbound', 'return']);
const TRIP_UPDATE_TYPES = Object.freeze([...BOOKING_STATUSES, 'arrived_pickup', 'picked_up', 'outbound_completed', 'return_pickup', 'return_unavailable',
  'return_completed', 'stop_completed', 'delayed', 'vehicle_failure', 'customer_route_change']);
const CHANGE_REQUEST_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'cancelled']);
const TRIP_WORKFLOW_MESSAGES = Object.freeze({
  PICKUP_CONFIRMATION_WINDOW: 'Chỉ xác nhận đón khách trong ngày đón, từ 1 giờ trước giờ hẹn.',
});

module.exports = { BOOKING_STATUSES, PAYMENT_STATUSES, REFUND_STATUSES, INCIDENT_STATUSES, MAINTENANCE_STATUSES,
  CONFIGURATION_STATUSES, USER_STATUS, USER_STATUSES, VEHICLE_STATUS, VEHICLE_STATUSES, DRIVER_AVAILABILITY_STATUS, DRIVER_AVAILABILITY_STATUSES, ASSIGNMENT_STATUSES,
  CANCELLATION_STATUSES, HANDOVER_STATUSES, TRIP_WORKFLOW_STAGES, DRIVER_RESPONSES, TRIP_LEGS,
  TRIP_UPDATE_TYPES, CHANGE_REQUEST_STATUSES, APPROVAL_STATUSES, TRIP_WORKFLOW_MESSAGES };
