import { reviewCompensation, reviewIncident, reviewVehicle, updatePolicy, updateStaff } from '../api/managerApi';

export default function useManagerActions() {
  return { reviewCompensation, reviewIncident, reviewVehicle, updatePolicy, updateStaff };
}
