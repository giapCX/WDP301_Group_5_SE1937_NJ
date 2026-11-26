const SERVICE_TYPES = Object.freeze({ ROUNDTRIP: 'roundtrip', TOUR: 'tour' });
const { CONFIGURATION_STATUSES: PRICING_STATUSES } = require('./workflow.constants');
const PRICING_RATE_FIELDS = Object.freeze([
  'km_rate', 'dispatch_percent', 'day_rate', 'included_km_per_day', 'extra_km_rate', 'driver_night_rate',
]);

module.exports = { SERVICE_TYPES, PRICING_STATUSES, PRICING_RATE_FIELDS };
