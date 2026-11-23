import { getApi, getBlobApi, patchApi, postApi } from '../../../api/client';

function queryString(params = {}) {
  const query = new URLSearchParams(Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)]));
  return query.size ? `?${query}` : '';
}

export const getOperatorDashboard = (options) => getApi('/operator/dashboard', options);
export const getOperatorRentalResource = (resource, { signal, ...params }) =>
  getApi(`/operator/${resource}${queryString(params)}`, { signal });
export const operatorListingActions = {
  updateListing: (id, body) => patchApi(`/operator/listings/${encodeURIComponent(id)}`, body),
  reviewListing: (id, body) => patchApi(`/operator/listings/${encodeURIComponent(id)}/review`, body),
};
export const decideOperatorBooking = (id, body) =>
  patchApi(`/operator/bookings/${encodeURIComponent(id)}/decision`, body);
export const getOperatorInspectionWorkflow = (params, options) => getApi(`/operator/inspection-workflow${queryString(params)}`, options);
export const getOperatorVehicles = (params, options) => getApi(`/operator/vehicles${queryString(params)}`, options);
export const getOperatorGarageStaff = (options) => getApi('/operator/vehicles/garage-staff', options);
export const getOperatorVehicle = (id, options) => getApi(`/operator/vehicles/${encodeURIComponent(id)}`, options);
export const getOperatorVehicleDocument = (id, kind, options) => getBlobApi(`/operator/vehicles/${encodeURIComponent(id)}/documents/${encodeURIComponent(kind)}`, options);
export const updateOperatorVehicleStatus = (id, body) => patchApi(`/operator/vehicles/${encodeURIComponent(id)}/status`, body);
export const reviewOperatorVehicleDocuments = (id, body) => postApi(`/operator/vehicles/${encodeURIComponent(id)}/document-review`, body);
export const confirmOperatorVehicleArrival = (id, body) => postApi(`/operator/vehicles/${encodeURIComponent(id)}/arrival-confirmation`, body);
export const scheduleOperatorVehicleInspection = (id, body) => postApi(`/operator/vehicles/${encodeURIComponent(id)}/inspection-schedule`, body);
export const updateOperatorVehicleInspectionSchedule = (id, body) => patchApi(`/operator/vehicles/${encodeURIComponent(id)}/inspection-schedule`, body);
export const precheckOperatorVehicleInspection = (id, body) => postApi(`/operator/inspections/${encodeURIComponent(id)}/precheck`, body);
export const getOperatorIncidents = (params, options) => getApi(`/operator/incidents${queryString(params)}`, options);
export const getOperatorIncident = (id, options) => getApi(`/operator/incidents/${encodeURIComponent(id)}`, options);
export const createOperatorIncident = (body) => postApi('/operator/incidents', body);
export const updateOperatorIncident = (id, body) => patchApi(`/operator/incidents/${encodeURIComponent(id)}`, body);
export const submitOperatorIncident = (id) => postApi(`/operator/incidents/${encodeURIComponent(id)}/submit`, {});
export const receiveOperatorIncident = (id) => postApi(`/operator/incidents/${encodeURIComponent(id)}/receive`, {});
export const attachOperatorEvidence = (id, file) => postApi(`/operator/incidents/${encodeURIComponent(id)}/evidence`, { file });
export const getOperatorEvidence = (id, index, options) => getBlobApi(`/operator/incidents/${encodeURIComponent(id)}/evidence/${index}`, options);
