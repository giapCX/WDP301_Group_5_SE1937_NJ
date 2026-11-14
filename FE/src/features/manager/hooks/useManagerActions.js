import {
  createAccount, createRole, createStaff, decideBooking, getSystemReport, reviewCompensation,
  reviewIncident, reviewVehicle, reviewIdentityVerification, reviewTrafficViolation, saveSystemReport, updateAccount, updateContract,
  reviewListing, updateListing, updatePolicy, updateRole, updateStaff,
} from '../api/managerApi';

export default function useManagerActions() {
  return {
    createAccount, createRole, createStaff, decideBooking, getSystemReport, reviewCompensation,
    reviewIncident, reviewVehicle, reviewIdentityVerification, reviewTrafficViolation, saveSystemReport, updateAccount, updateContract,
    reviewListing, updateListing, updatePolicy, updateRole, updateStaff,
  };
}
