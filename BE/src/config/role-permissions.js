const ROLE_DEFAULT_PERMISSIONS = {
  admin: ['account.read', 'account.write', 'account.lock', 'role.assign', 'vehicle.read', 'vehicle.write', 'vehicle.review', 'listing.manage', 'garage.manage', 'driver.read', 'driver.write', 'driver.review', 'pricing.manage', 'policy.manage', 'promotion.manage', 'booking.read.all', 'booking.review', 'booking.change.read', 'contract.sign', 'report.read', 'payment.manage', 'audit.read'],
  manager: ['vehicle.read', 'vehicle.write', 'vehicle.review', 'listing.manage', 'driver.read', 'driver.write', 'driver.review', 'pricing.manage', 'policy.manage', 'promotion.manage', 'booking.read.all', 'booking.review', 'booking.change.read', 'contract.sign', 'report.read', 'payment.manage', 'audit.read'],
  operator: ['vehicle.read', 'vehicle.write', 'listing.manage', 'garage.manage', 'driver.read', 'booking.read.all', 'booking.review', 'booking.change.read', 'contract.sign', 'audit.read'],
  garage_staff: ['vehicle.read', 'vehicle.review', 'garage.manage', 'driver.read', 'audit.read'],
  driver: ['booking.read.own'],
  renter: ['booking.read.own'],
};

module.exports = ROLE_DEFAULT_PERMISSIONS;
