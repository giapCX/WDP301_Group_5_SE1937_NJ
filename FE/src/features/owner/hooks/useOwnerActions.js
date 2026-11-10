import { getOwnerAgreement, reportOwnerIncident, requestOwnerPayout, requestOwnerVehicleWithdrawal, signOwnerAgreement } from '../api/ownerApi';

export default function useOwnerActions() {
  return {
    getAgreement: (id) => getOwnerAgreement(id),
    signAgreement: (id, payload) => signOwnerAgreement(id, payload),
    requestPayout: (payload) => requestOwnerPayout(payload),
    requestVehicleWithdrawal: (payload) => requestOwnerVehicleWithdrawal(payload),
    reportIncident: (payload) => reportOwnerIncident(payload),
  };
}
