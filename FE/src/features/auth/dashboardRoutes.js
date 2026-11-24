const dashboards = new Map([
  ['renter', '/renter/dashboard'],
  ['operator', '/operator/bookings'],
  ['manager', '/manager/dashboard'],
]);

export function dashboardForRole(role) {
  return dashboards.get(role) || '/';
}
