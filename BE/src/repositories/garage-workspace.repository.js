import { getModels } from '../models/index.js';

export function createGarageWorkspaceRepository(connection) {
  const m = getModels(connection);
  return {
    async snapshot(permissions, actor) {
      const inspect = permissions.includes('vehicle.inspect');
      const intake = permissions.includes('vehicle.intake');
      const handover = permissions.includes('handover.record');
      const report = permissions.includes('case.report');
      const [vehicles, inspections, intakes, agreements, bookings, handovers, incidents, history] = await Promise.all([
        m.Vehicle.find({}, { brand: 1, model: 1, owner_id: 1, license_plate: 1, onboarding_status: 1, physical_status: 1, review_note: 1, created_at: 1 }).lean(),
        inspect ? m.VehicleInspection.find({ inspection_type: 'onboarding' }).lean() : [],
        intake ? m.VehicleIntake.find().lean() : [],
        intake ? m.ManagementAgreement.find({}, { vehicle_id: 1, owner_id: 1, agreement_number: 1, created_at: 1 }).sort({ created_at: -1, _id: -1 }).lean() : [],
        handover ? m.Booking.find({}, { booking_code: 1, vehicle_id: 1, renter_id: 1, start_at: 1, end_at: 1, status: 1, pickup_location: 1, return_location: 1 }).lean() : [],
        handover ? m.RentalHandover.find().lean() : [],
        report ? m.IncidentCase.find({ reported_by_user_id: actor._id }, { case_number: 1, vehicle_id: 1, booking_id: 1, description: 1, severity: 1, evidence: 1, created_at: 1, status: 1 }).sort({ created_at: -1 }).lean() : [],
        m.AuditLog.find({ actor_user_id: actor._id, action: { $regex: '^(vehicle\\.(inspection|intake)\\.|garage\\.)' } }, { action: 1, entity_id: 1, created_at: 1 }).sort({ created_at: -1 }).lean(),
      ]);
      const ids = [...vehicles.map((v) => v.owner_id), ...bookings.map((b) => b.renter_id)].filter(Boolean);
      const users = await m.User.find({ _id: { $in: ids } }, { full_name: 1 }).lean();
      return { vehicles, inspections, intakes, agreements, bookings, handovers, incidents, history, users };
    },
  };
}
