import { ObjectId } from 'mongodb';
import { httpError, objectId } from '../../utils/http-error.js';

export const OPEN_CASES = [
  'reported',
  'open',
  'investigating',
  'in_progress',
  'under_review',
  'awaiting_response',
  'pending_manager',
];

export const toOperationId = (value, field = 'id') =>
  new ObjectId(objectId(value, field));

export const escapeOperationSearch = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const operationPageInfo = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export function createOperationContext(repository) {
  const actorId = (request) => toOperationId(request.tokenPayload.sub, 'userId');

  async function audit(request, action, entityType, entityId, changes = {}) {
    await repository.insertOne('audit_logs', {
      actor_user_id: actorId(request),
      action,
      entity_type: entityType,
      entity_id: entityId,
      sanitized_changes: changes,
      ip_address_masked: null,
      created_at: new Date(),
    });
  }

  async function joinUsers(ids) {
    const unique = [...new Map(
      ids.filter(Boolean).map((id) => [id.toString(), id]),
    ).values()];
    if (!unique.length) return new Map();
    const users = await repository.collection('users')
      .find({ _id: { $in: unique } })
      .project({ full_name: 1, email: 1, phone: 1 })
      .toArray();
    return new Map(users.map((user) => [user._id.toString(), user]));
  }

  async function bookingRows(rows) {
    const users = await joinUsers(rows.map((row) => row.renter_id));
    const vehicleIds = [...new Map(
      rows.map((row) => row.vehicle_id).filter(Boolean)
        .map((id) => [id.toString(), id]),
    ).values()];
    const vehicles = vehicleIds.length
      ? await repository.collection('vehicles')
        .find({ _id: { $in: vehicleIds } })
        .project({ brand: 1, model: 1, license_plate: 1, manufacture_year: 1 })
        .toArray()
      : [];
    const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle._id.toString(), vehicle]));
    return rows.map((row) => ({
      id: row._id.toString(),
      bookingCode: row.booking_code,
      status: row.status,
      startAt: row.start_at,
      endAt: row.end_at,
      actualEndAt: row.actual_end_at,
      rentalFeeAmount: row.rental_fee_amount,
      lateFeePerHour: row.pricing_snapshot?.late_fee_per_hour || 0,
      renter: users.get(row.renter_id?.toString()) || null,
      vehicle: vehicleMap.get(row.vehicle_id?.toString()) || null,
      listingId: row.listing_id?.toString() || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reviewInfo: row.review_info || {},
      statusHistory: row.status_history || [],
    }));
  }

  async function caseRows(rows) {
    const users = await joinUsers(
      rows.map((row) => row.reported_by_user_id)
        .concat(rows.map((row) => row.assigned_operation_staff_id)),
    );
    return rows.map((row) => ({
      id: row._id.toString(),
      caseNumber: row.case_number,
      caseType: row.case_type,
      status: row.status,
      description: row.description,
      investigation: row.investigation || {},
      trafficViolation: row.traffic_violation_details || null,
      compensationClaims: row.compensation_claims || [],
      evidence: row.evidence || [],
      bookingId: row.booking_id?.toString() || null,
      vehicleId: row.vehicle_id?.toString() || null,
      reporter: users.get(row.reported_by_user_id?.toString()) || null,
      assignedStaff: users.get(row.assigned_operation_staff_id?.toString()) || null,
      timeline: row.operation_timeline || [],
      resolution: row.resolution || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  return {
    actorId,
    audit,
    bookingRows,
    caseRows,
    joinUsers,
    repository,
  };
}

export function createOperationAccessService(repository) {
  return {
    authorizeOperationStaff: async (request, _response, next) => {
      try {
        const roleIds = [
          request.user.primary_role_id,
          ...(request.user.additional_role_ids || []),
        ].filter(Boolean);
        const roles = roleIds.length
          ? await repository.collection('roles')
            .find({ _id: { $in: roleIds } })
            .project({ code: 1 })
            .toArray()
          : [];
        const roleCodes = roles.map((role) => role.code);
        if (!roleCodes.includes('OPERATION_STAFF') && !roleCodes.includes('ADMIN')) {
          return next(httpError(403, 'Bạn không có quyền truy cập khu vực vận hành.'));
        }
        request.currentRoles = roleCodes;
        return next();
      } catch (error) {
        return next(error);
      }
    },
  };
}
