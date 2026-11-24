const dashboards = new Map([
  ['driver', '/driver/dashboard'],
  ['renter', '/renter/dashboard'],
  ['operator', '/operator/dashboard'],
  ['manager', '/manager/dashboard'],
]);

export function dashboardForRole(role) {
  return dashboards.get(role) || '/';
}
