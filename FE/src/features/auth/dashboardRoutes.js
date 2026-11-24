const dashboards = new Map([
  ['driver', '/driver/dashboard'],
  ['renter', '/renter/dashboard'],
  ['operator', '/operator/bookings'],
]);

export function dashboardForRole(role) {
  return dashboards.get(role) || '/';
}
