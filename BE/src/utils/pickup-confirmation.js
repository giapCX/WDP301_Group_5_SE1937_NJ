const { VIETNAM_TIME_ZONE, VIETNAM_DATE_LOCALE, PICKUP_CONFIRMATION_LEAD_TIME_MS } = require('../config/time.constants');

const vietnamDate = new Intl.DateTimeFormat(VIETNAM_DATE_LOCALE, { timeZone: VIETNAM_TIME_ZONE });

function isPickupConfirmationAvailable(pickupTime, currentTime = new Date()) {
  const pickup = new Date(pickupTime);
  const current = new Date(currentTime);
  if (!Number.isFinite(pickup.getTime()) || !Number.isFinite(current.getTime())) return false;

  const sameVietnamDay = vietnamDate.format(pickup) === vietnamDate.format(current);
  const earliestConfirmationTime = pickup.getTime() - PICKUP_CONFIRMATION_LEAD_TIME_MS;
  return sameVietnamDay && current.getTime() >= earliestConfirmationTime;
}

module.exports = { isPickupConfirmationAvailable };