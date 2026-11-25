const ROLE_DEFAULT_PERMISSIONS = {
  admin: ['account.read', 'account.write', 'account.lock', 'role.assign', 'audit.read'],
  manager: ['booking.review', 'maintenance.review', 'payment.manage', 'pricing.manage', 'policy.manage', 'promotion.manage', 'report.read', 'audit.read'],
  operator: ['vehicle.read', 'vehicle.write', 'listing.manage', 'garage.manage', 'driver.read', 'booking.read.all', 'booking.review', 'booking.change.read', 'contract.sign', 'audit.read'],
  garage_staff: ['vehicle.read', 'vehicle.review', 'garage.manage', 'driver.read', 'audit.read'],
  driver: ['booking.read.own'],
  renter: ['booking.read.own'],
};

module.exports = ROLE_DEFAULT_PERMISSIONS;
