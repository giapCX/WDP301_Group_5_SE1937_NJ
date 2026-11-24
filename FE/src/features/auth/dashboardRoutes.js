const dashboards = new Map([
  ['admin', '/admin/roles-permissions'],
  ['driver', '/driver/dashboard'],
  ['renter', '/renter/dashboard'],
  ['operator', '/operator/bookings'],
  ['manager', '/manager/dashboard'],
]);

export function dashboardForRole(role) {
  return dashboards.get(role) || '/';
}
