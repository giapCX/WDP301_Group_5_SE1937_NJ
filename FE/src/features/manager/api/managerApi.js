import {
  getApi,
  patchApi,
  postApi,
  putApi,
} from "../../../services/httpClient";

const resourcePaths = {
  vehicles: "/vehicles?status=pending",
  bookings: "/bookings",
  listings: "/listings",
  incidents: "/incidents?status=open",
  policies: "/policies",
  staff: "/staff",
  finance: "/reports/finance",
  inspections: "/reports/inspections",
  operations: "/reports/operations",
  accounts: "/accounts",
  roles: "/roles",
  auditLogs: "/audit-logs",
  adminOverview: "/admin/overview",
  savedReports: "/reports/system",
  identityVerifications: "/identity-verifications?status=pending",
};

export function getManagerResource(
  resource,
  { from, to, signal, type, page, limit, q } = {},
) {
  let path =
    resource === "contracts"
      ? `/contracts?type=${encodeURIComponent(type || "management")}`
      : resourcePaths[resource];
  if (!path) throw new Error(`Unknown manager resource: ${resource}`);
  const query = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(page ? { page } : {}),
    ...(limit ? { limit } : {}),
    ...(q ? { q } : {}),
  });
  const separator = path.includes("?") ? "&" : "?";
  const queryString = query.toString();
  return getApi(
    `/manager${path}${queryString ? `${separator}${queryString}` : ""}`,
    { signal },
  );
}

export const getManagerDashboard = (period, options) =>
  getApi(`/manager/dashboard?period=${encodeURIComponent(period)}`, options);
export const reviewVehicle = (id, body) =>
  patchApi(`/manager/vehicles/${id}/review`, body);
export const decideBooking = (id, body) =>
  patchApi(`/manager/bookings/${id}/decision`, body);
export const updateListing = (id, body) =>
  patchApi(`/manager/listings/${id}`, body);
export const reviewListing = (id, body) =>
  patchApi(`/manager/listings/${id}/review`, body);
export const reviewIdentityVerification = (id, body) =>
  patchApi(`/manager/identity-verifications/${id}/review`, body);
export const reviewCompensation = (id, body) =>
  patchApi(`/manager/incidents/${id}/compensation`, body);
export const reviewIncident = (id, body) =>
  patchApi(`/manager/incidents/${id}/review`, body);
export const reviewTrafficViolation = (id, body) =>
  patchApi(`/manager/incidents/${id}/violation`, body);
export const updatePolicy = (type, body) =>
  putApi(`/manager/policies/${type}`, body);
export const updateStaff = (id, body) => patchApi(`/manager/staff/${id}`, body);
export const createStaff = (body) => postApi("/manager/staff", body);
export const createAccount = (body) => postApi("/manager/accounts", body);
export const updateAccount = (id, body) =>
  patchApi(`/manager/accounts/${id}`, body);
export const updateRole = (id, body) => patchApi(`/manager/roles/${id}`, body);
export const createRole = (body) => postApi("/manager/roles", body);
export const updateContract = (type, id, body) =>
  patchApi(`/manager/contracts/${type}/${id}`, body);
export const saveSystemReport = (body) =>
  postApi("/manager/reports/system", body);
export const getSystemReport = (id) => getApi(`/manager/reports/system/${id}`);
