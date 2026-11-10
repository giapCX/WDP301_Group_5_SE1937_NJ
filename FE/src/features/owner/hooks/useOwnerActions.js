import { reportOwnerIncident, requestOwnerPayout, requestOwnerVehicleWithdrawal, resubmitVehicleDocuments, signOwnerAgreement } from '../api/ownerApi';

export default function useOwnerActions() {
  return {
    signAgreement: (id, payload) => signOwnerAgreement(id, payload),
    requestPayout: (payload) => requestOwnerPayout(payload),
    requestVehicleWithdrawal: (payload) => requestOwnerVehicleWithdrawal(payload),
    reportIncident: (payload) => reportOwnerIncident(payload),
    resubmitVehicleDocuments: (id, payload) => resubmitVehicleDocuments(id, payload),
  };
}
