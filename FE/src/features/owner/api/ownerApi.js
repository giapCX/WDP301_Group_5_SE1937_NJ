import { getApi, postApi, patchApi } from '../../../services/httpClient';

export const getOwnerDashboard = (options) => getApi('/owner/dashboard', options);
export const registerOwnerVehicle = (body) => postApi('/owner/vehicles', body);
export const requestOwnerInspectionSchedule = (id, body) => postApi(`/owner/vehicles/${encodeURIComponent(id)}/inspection-schedule-requests`, body);
export const resubmitVehicleDocuments = (id, body) => patchApi(`/owner/vehicles/${encodeURIComponent(id)}/documents`, body);
export const respondToOwnerInspection = (vehicleId, inspectionId, body) => patchApi(
  `/owner/vehicles/${encodeURIComponent(vehicleId)}/inspections/${encodeURIComponent(inspectionId)}`, body,
);
export const respondToOwnerIntake = (vehicleId, intakeId, body) => patchApi(
  `/owner/vehicles/${encodeURIComponent(vehicleId)}/intakes/${encodeURIComponent(intakeId)}`, body,
);
export const getOwnerAgreement = (id, options) => getApi(`/owner/agreements/${encodeURIComponent(id)}`, options);
export const signOwnerAgreement = (id, body) => postApi(`/owner/agreements/${encodeURIComponent(id)}/sign`, body);
export const requestOwnerPayout = (body) => postApi('/owner/payout-requests', body);
export const confirmOwnerReturn = (id, body) => patchApi(`/owner/vehicle-withdrawals/${encodeURIComponent(id)}/handover`, body);
export const requestOwnerVehicleWithdrawal = (body) => postApi('/owner/vehicle-withdrawals', body);
export const reportOwnerIncident = (body) => postApi('/owner/incidents', body);
