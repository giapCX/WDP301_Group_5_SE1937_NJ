const dashboards = new Map([
  ['renter', '/renter/dashboard'],
  ['operator', '/operator/bookings'],
]);

export function dashboardForRole(role) {
  return dashboards.get(role) || '/';
}
