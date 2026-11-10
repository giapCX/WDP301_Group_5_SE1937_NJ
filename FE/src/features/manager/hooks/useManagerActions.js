import {
  createAccount, createRole, createStaff, getSystemReport, reviewCompensation,
  reviewIncident, reviewVehicle, reviewIdentityVerification, saveSystemReport, updateAccount, updateContract,
  updatePolicy, updateRole, updateStaff,
} from '../api/managerApi';

export default function useManagerActions() {
  return {
    createAccount, createRole, createStaff, getSystemReport, reviewCompensation,
    reviewIncident, reviewVehicle, reviewIdentityVerification, saveSystemReport, updateAccount, updateContract,
    updatePolicy, updateRole, updateStaff,
  };
}
