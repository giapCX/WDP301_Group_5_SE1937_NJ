import { OPEN_CASES } from '../../modules/operation/operation.context.js';

export function createOperationDashboardService(repository) {
  return {
    async dashboard() {
      const now = new Date();
      const [
        pendingBookings,
        activeRentals,
        overdueRentals,
        openIncidents,
        openViolations,
        openDisputes,
        openComplaints,
      ] = await Promise.all([
        repository.count('bookings', { status: 'pending' }),
        repository.count('bookings', { status: 'ongoing' }),
        repository.count('bookings', {
          status: 'ongoing',
          end_at: { $lt: now },
          actual_end_at: null,
        }),
        repository.count('incident_cases', {
          case_type: { $nin: ['traffic_violation', 'dispute', 'complaint'] },
          status: { $in: OPEN_CASES },
        }),
        repository.count('incident_cases', {
          case_type: 'traffic_violation',
          status: { $in: OPEN_CASES },
        }),
        repository.count('incident_cases', {
          case_type: 'dispute',
          status: { $in: OPEN_CASES },
        }),
        repository.count('incident_cases', {
          case_type: 'complaint',
          status: { $in: OPEN_CASES },
        }),
      ]);

      return {
        data: {
          metrics: {
            pendingBookings,
            activeRentals,
            overdueRentals,
            openIncidents,
            openViolations,
            openDisputes,
            openComplaints,
          },
        },
      };
    },
  };
}
