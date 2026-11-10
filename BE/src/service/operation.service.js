import { Types } from 'mongoose';
import { httpError, objectId } from '../utils/http-error.js';
import {
  parseBookingDecision,
  parseCaseUpdate,
  parseListingReview,
  parseListingUpdate,
  parseOperationListQuery,
  parseOverdueAction,
  parseVehicleScreen,
  parseViolationDecision,
} from '../validators/operation.validator.js';

const OPEN_CASES = ['reported', 'open', 'investigating', 'in_progress', 'under_review', 'awaiting_response', 'pending_manager', 'pending_review'];
const BOOKING_REVIEW_WINDOW_MS = 2 * 60 * 60 * 1000;
const BOOKING_PAYMENT_WINDOW_MS = 15 * 60 * 1000;
const MINIMUM_PICKUP_NOTICE_MS = 2 * 60 * 60 * 1000;
const OVERDUE_GRACE_PERIOD_MS = 30 * 60 * 1000;
const OVERDUE_ESCALATION_WINDOW_MS = 4 * 60 * 60 * 1000;
const { ObjectId } = Types;
const CASE_TRANSITIONS = {
  open: ['in_progress', 'under_review'],
  reported: ['in_progress', 'under_review', 'awaiting_response', 'pending_manager', 'need_more_information'],
  investigating: ['in_progress', 'under_review', 'awaiting_response', 'pending_manager', 'need_more_information', 'resolved', 'escalated'],
  in_progress: ['under_review', 'awaiting_response', 'pending_manager', 'need_more_information', 'resolved', 'escalated'],
  under_review: ['awaiting_response', 'pending_manager', 'need_more_information', 'resolved', 'escalated'],
  awaiting_response: ['investigating', 'pending_manager', 'need_more_information', 'resolved', 'escalated'],
  pending_manager: ['investigating', 'awaiting_response', 'resolved', 'closed'],
  need_more_information: ['investigating', 'awaiting_response', 'pending_manager'],
  resolved: ['closed'],
  escalated: ['under_review', 'resolved'],
};
const toId = (value, field = 'id') => new ObjectId(objectId(value, field));
const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageInfo = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });

function transition(current, next, { dispute = false } = {}) {
  const source = current === 'reported' ? 'open' : current === 'investigating' ? 'in_progress' : current;
  const target = next === 'open' ? 'open' : next;
  if (source === target) return;
  const allowed = dispute && source === 'open' ? ['under_review'] : CASE_TRANSITIONS[source] || [];
  if (!allowed.includes(target)) throw httpError(409, `Không thể chuyển hồ sơ từ ${current} sang ${next}.`);
}

export function createOperationService(repository) {
  const actorId = (request) => toId(request.tokenPayload.sub, 'userId');

  async function expireStaleBookings(now = new Date()) {
    const reviewDeadline = new Date(now.getTime() - BOOKING_REVIEW_WINDOW_MS);
    await repository.updateMany('bookings', {
      status: 'pending',
      created_at: { $lte: reviewDeadline },
    }, {
      $set: { status: 'expired', updated_at: now },
      $push: { status_history: { from: 'pending', to: 'expired', at: now, actor: 'system', reason: 'review_timeout' } },
    });
    await repository.updateMany('bookings', {
      status: 'awaiting_payment',
      payment_deadline_at: { $lte: now },
    }, {
      $set: { status: 'expired', updated_at: now },
      $push: { status_history: { from: 'awaiting_payment', to: 'expired', at: now, actor: 'system', reason: 'payment_timeout' } },
    });
  }

  async function audit(request, action, entityType, entityId, changes = {}) {
    const now = new Date();
    await repository.insertOne('audit_logs', {
      actor_user_id: actorId(request), action, entity_type: entityType, entity_id: entityId,
      sanitized_changes: changes, ip_address_masked: null, created_at: now,
    });
  }

  async function joinUsers(ids) {
    const unique = [...new Map(ids.filter(Boolean).map((id) => [id.toString(), id])).values()];
    if (!unique.length) return new Map();
    const users = await repository.collection('users').find({ _id: { $in: unique } })
      .project({ full_name: 1, email: 1, phone: 1 }).toArray();
    return new Map(users.map((user) => [user._id.toString(), user]));
  }

  async function bookingRows(rows) {
    const users = await joinUsers(rows.map((row) => row.renter_id));
    const vehicleIds = [...new Map(rows.map((row) => row.vehicle_id).filter(Boolean).map((id) => [id.toString(), id])).values()];
    const vehicles = vehicleIds.length ? await repository.collection('vehicles').find({ _id: { $in: vehicleIds } })
      .project({ brand: 1, model: 1, license_plate: 1, manufacture_year: 1 }).toArray() : [];
    const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle._id.toString(), vehicle]));
    return rows.map((row) => ({
      id: row._id.toString(), bookingCode: row.booking_code, status: row.status,
      startAt: row.start_at, endAt: row.end_at, actualEndAt: row.actual_end_at,
      rentalFeeAmount: row.rental_fee_amount, lateFeePerHour: row.pricing_snapshot?.late_fee_per_hour || 0,
      renter: users.get(row.renter_id?.toString()) || null,
      vehicle: vehicleMap.get(row.vehicle_id?.toString()) || null,
      listingId: row.listing_id?.toString() || null, createdAt: row.created_at, updatedAt: row.updated_at,
      reviewInfo: row.review_info || {}, statusHistory: row.status_history || [],
    }));
  }

  async function caseRows(rows) {
    const users = await joinUsers(rows.map((row) => row.reported_by_user_id).concat(rows.map((row) => row.assigned_operation_staff_id)));
    return rows.map((row) => ({
      id: row._id.toString(), caseNumber: row.case_number, caseType: row.case_type, status: row.status,
      description: row.description, investigation: row.investigation || {}, trafficViolation: row.traffic_violation_details || null,
      compensationClaims: row.compensation_claims || [], evidence: row.evidence || [], bookingId: row.booking_id?.toString() || null,
      vehicleId: row.vehicle_id?.toString() || null, reporter: users.get(row.reported_by_user_id?.toString()) || null,
      assignedStaff: users.get(row.assigned_operation_staff_id?.toString()) || null,
      timeline: row.operation_timeline || [], resolution: row.resolution || null,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }));
  }

  async function listCases(request, type) {
    const query = parseOperationListQuery(request.query, { statuses: ['reported', 'open', 'investigating', 'in_progress', 'under_review', 'awaiting_response', 'pending_manager', 'need_more_information', 'resolved', 'escalated', 'closed'] });
    const filter = type === 'incident'
      ? { case_type: { $nin: ['traffic_violation', 'dispute', 'complaint'] } }
      : type ? { case_type: type } : {};
    if (query.status !== 'all') filter.status = query.status;
    if (query.q) filter.$or = [
      { case_number: { $regex: escaped(query.q), $options: 'i' } },
      { description: { $regex: escaped(query.q), $options: 'i' } },
    ];
    const [rows, total] = await Promise.all([
      repository.findMany('incident_cases', filter, { ...query, sortBy: query.sortBy.updated_at ? { updated_at: query.sortBy.updated_at, _id: query.sortBy._id } : query.sortBy }),
      repository.count('incident_cases', filter),
    ]);
    return { data: await caseRows(rows), pagination: pageInfo(query.page, query.limit, total) };
  }

  return {
    // Access boundary: only active Operation Staff and Admin roles enter this module.
    authorizeOperationStaff: async (request, _response, next) => {
      try {
        const roleIds = [request.user.primary_role_id, ...(request.user.additional_role_ids || [])].filter(Boolean);
        const roles = roleIds.length ? await repository.collection('roles').find({ _id: { $in: roleIds } }).project({ code: 1 }).toArray() : [];
        const roleCodes = roles.map((role) => role.code);
        if (!roleCodes.includes('OPERATION_STAFF') && !roleCodes.includes('ADMIN'))
          return next(httpError(403, 'Bạn không có quyền truy cập khu vực vận hành.'));
        request.currentRoles = roleCodes;
        next();
      } catch (error) { next(error); }
    },

    // Dashboard and booking queue: expire stale holds before showing or deciding bookings.
    async dashboard() {
      const now = new Date();
      await expireStaleBookings(now);
      const [pendingBookings, activeRentals, overdueRentals, openIncidents, openViolations, openDisputes, openComplaints] = await Promise.all([
        repository.count('bookings', { status: 'pending' }),
        repository.count('bookings', { status: 'ongoing' }),
        repository.count('bookings', { status: 'ongoing', end_at: { $lt: now }, actual_end_at: null }),
        repository.count('incident_cases', { case_type: { $nin: ['traffic_violation', 'dispute', 'complaint'] }, status: { $in: OPEN_CASES } }),
        repository.count('incident_cases', { case_type: 'traffic_violation', status: { $in: OPEN_CASES } }),
        repository.count('incident_cases', { case_type: 'dispute', status: { $in: OPEN_CASES } }),
        repository.count('incident_cases', { case_type: 'complaint', status: { $in: OPEN_CASES } }),
      ]);
      return { data: { metrics: { pendingBookings, activeRentals, overdueRentals, openIncidents, openViolations, openDisputes, openComplaints } } };
    },

    async listBookings(query) {
      await expireStaleBookings();
      const parsed = parseOperationListQuery(query, { statuses: ['pending', 'awaiting_payment', 'confirmed', 'ongoing', 'completed', 'cancelled', 'rejected', 'expired'] });
      const filter = parsed.status === 'all' ? {} : { status: parsed.status };
      if (parsed.q) filter.$or = [
        { booking_code: { $regex: escaped(parsed.q), $options: 'i' } },
        { status: { $regex: escaped(parsed.q), $options: 'i' } },
      ];
      const sortBy = parsed.sortBy.start_at ? parsed.sortBy : { created_at: parsed.sortBy.created_at, _id: parsed.sortBy._id };
      const [rows, total] = await Promise.all([
        repository.findMany('bookings', filter, { ...parsed, sortBy }), repository.count('bookings', filter),
      ]);
      return { data: await bookingRows(rows), pagination: pageInfo(parsed.page, parsed.limit, total) };
    },

    async getBooking(id) {
      const booking = await repository.findById('bookings', toId(id));
      if (!booking) throw httpError(404, 'Không tìm thấy booking.');
      return { data: (await bookingRows([booking]))[0] };
    },

    async decideBooking(request, idValue, body) {
      const id = toId(idValue);
      const { action, reason } = parseBookingDecision(body);
      const now = new Date();
      await expireStaleBookings(now);
      const current = await repository.findById('bookings', id);
      if (!current || current.status !== 'pending') throw httpError(409, 'Booking không còn ở trạng thái chờ xử lý.');
      if (action === 'approve' && (!(current.start_at instanceof Date) || current.start_at.getTime() < now.getTime() + MINIMUM_PICKUP_NOTICE_MS))
        throw httpError(409, 'Thời gian nhận xe phải còn tối thiểu 2 giờ; yêu cầu booking lịch mới.');
      const status = action === 'approve' ? 'awaiting_payment' : 'rejected';
      const decision = action === 'approve' ? 'approved' : 'rejected';
      const paymentDeadline = action === 'approve' ? new Date(now.getTime() + BOOKING_PAYMENT_WINDOW_MS) : null;
      const result = await repository.updateOne('bookings', { _id: id, status: 'pending' }, {
        $set: { status, updated_at: now, 'review_info.required': true, 'review_info.decision': decision,
          'review_info.reviewed_by': actorId(request), 'review_info.reviewed_at': now, 'review_info.reason': reason,
          ...(paymentDeadline ? { payment_deadline_at: paymentDeadline } : {}) },
        $push: { status_history: { from: 'pending', to: status, at: now, actor: actorId(request), reason } },
      });
      if (!result.modifiedCount) throw httpError(409, 'Booking không còn ở trạng thái chờ xử lý.');
      await audit(request, `booking.${action}`, 'bookings', id, { status, reason });
      return { data: { id: id.toString(), status, decision, ...(paymentDeadline ? { paymentDeadline } : {}) } };
    },

    // Listing operations: update listing content and publish only eligible, garage-held vehicles.
    async listListings(query) {
      const parsed = parseOperationListQuery(query, { statuses: ['draft', 'pending_review', 'published', 'suspended', 'archived', 'rejected'] });
      const filter = parsed.status === 'all' ? {} : { status: parsed.status };
      if (parsed.q) filter.$or = [{ title: { $regex: escaped(parsed.q), $options: 'i' } }, { description: { $regex: escaped(parsed.q), $options: 'i' } }];
      const [rows, total] = await Promise.all([
        repository.findMany('vehicle_listings', filter, { ...parsed, sortBy: { updated_at: -1, _id: -1 } }),
        repository.count('vehicle_listings', filter),
      ]);
      const ids = [...new Map(rows.map((row) => row.vehicle_id).filter(Boolean).map((id) => [id.toString(), id])).values()];
      const vehicles = ids.length ? await repository.collection('vehicles').find({ _id: { $in: ids } }).project({ brand: 1, model: 1, license_plate: 1, manufacture_year: 1, owner_id: 1 }).toArray() : [];
      const vehicleMap = new Map(vehicles.map((item) => [item._id.toString(), item]));
      const owners = await joinUsers(vehicles.map((item) => item.owner_id));
      return { data: rows.map((row) => {
        const vehicle = vehicleMap.get(row.vehicle_id?.toString());
        return { id: row._id.toString(), title: row.title, description: row.description, status: row.status,
          dailyPrice: row.daily_price, securityDepositAmount: row.security_deposit_amount, pickupLocation: row.pickup_location,
          photos: row.photos || [], vehicle: vehicle ? { ...vehicle, id: vehicle._id.toString(), owner: owners.get(vehicle.owner_id?.toString()) || null } : null,
          createdAt: row.created_at, updatedAt: row.updated_at };
      }), pagination: pageInfo(parsed.page, parsed.limit, total) };
    },

    async getListing(idValue) {
      const row = await repository.findById('vehicle_listings', toId(idValue));
      if (!row) throw httpError(404, 'Không tìm thấy tin xe.');
      const vehicle = row.vehicle_id ? await repository.findById('vehicles', row.vehicle_id) : null;
      const owners = await joinUsers(vehicle?.owner_id ? [vehicle.owner_id] : []);
      return { data: {
        id: row._id.toString(), title: row.title, description: row.description, status: row.status,
        dailyPrice: row.daily_price, securityDepositAmount: row.security_deposit_amount,
        pickupLocation: row.pickup_location, photos: row.photos || [],
        mileagePolicy: row.mileage_policy || {}, rentalPolicy: row.rental_policy_snapshot || {},
        vehicle: vehicle ? { id: vehicle._id.toString(), brand: vehicle.brand, model: vehicle.model,
          licensePlate: vehicle.license_plate, year: vehicle.manufacture_year,
          owner: owners.get(vehicle.owner_id?.toString()) || null } : null,
        createdAt: row.created_at, updatedAt: row.updated_at,
      } };
    },

    async updateListing(request, idValue, body) {
      const id = toId(idValue);
      const changes = parseListingUpdate(body);
      const now = new Date();
      const result = await repository.updateOne('vehicle_listings', { _id: id }, { $set: { ...changes, updated_at: now, updated_by_operation_staff_id: actorId(request) } });
      if (!result.matchedCount) throw httpError(404, 'Không tìm thấy tin xe.');
      await audit(request, 'listing.update', 'vehicle_listings', id, Object.keys(changes));
      return { data: {
        id: id.toString(),
        ...(changes.title !== undefined ? { title: changes.title } : {}),
        ...(changes.description !== undefined ? { description: changes.description } : {}),
        ...(changes.daily_price !== undefined ? { dailyPrice: changes.daily_price } : {}),
        ...(changes.security_deposit_amount !== undefined ? { securityDepositAmount: changes.security_deposit_amount } : {}),
        ...(changes.pickup_location !== undefined ? { pickupLocation: changes.pickup_location } : {}),
        updatedAt: now,
      } };
    },

    async reviewListing(request, idValue, body) {
      const id = toId(idValue);
      const { action, reason } = parseListingReview(body);
      const transitions = {
        approve: ['published', ['draft', 'pending_review', 'suspended']],
        reject: ['archived', ['draft', 'pending_review', 'published']],
        activate: ['published', ['suspended', 'archived']],
        deactivate: ['suspended', ['published']],
      };
      const [next, expected] = transitions[action];
      const current = await repository.findById('vehicle_listings', id);
      if (!current) throw httpError(404, 'Không tìm thấy tin xe.');
      if (!expected.includes(current.status)) throw httpError(409, 'Trạng thái tin xe không cho phép thao tác này.');
      if (action === 'approve' || action === 'activate') {
        const vehicle = await repository.findById('vehicles', current.vehicle_id);
        if (!vehicle || vehicle.onboarding_status !== 'approved')
          throw httpError(409, 'Chỉ xuất bản xe đã được Manager duyệt.');
        if (vehicle.physical_status !== 'at_garage')
          throw httpError(409, 'Chỉ xuất bản xe đã được Garage tiếp nhận.');
        const [agreement, intake] = await Promise.all([
          repository.collection('management_agreements').findOne({
            vehicle_id: vehicle._id,
            status: 'active',
            'signature_info.owner_signed_at': { $type: 'date' },
            'signature_info.platform_signed_at': { $type: 'date' },
          }),
          repository.collection('vehicle_intakes').findOne({ vehicle_id: vehicle._id, status: 'completed' }),
        ]);
        if (!agreement) throw httpError(409, 'Chỉ xuất bản xe có hợp đồng quản lý đã được hai bên ký và còn hiệu lực.');
        if (!intake) throw httpError(409, 'Chỉ xuất bản xe đã có biên bản tiếp nhận Gara hoàn tất.');
      }
      const now = new Date();
      const result = await repository.updateOne('vehicle_listings', { _id: id, status: { $in: expected } }, {
        $set: { status: next, updated_at: now, handled_by: actorId(request), handled_at: now, operation_review_note: reason },
      });
      if (!result.modifiedCount) throw httpError(409, 'Trạng thái tin xe không cho phép thao tác này.');
      await audit(request, `listing.${action}`, 'vehicle_listings', id, { status: next, reason });
      return { data: { id: id.toString(), status: next } };
    },

    // Staff assignment supports investigation queues and onboarding inspection scheduling.
    async listStaff() {
      const roles = await repository.collection('roles').find({ code: { $in: ['OPERATION_STAFF', 'ADMIN'] } }).project({ _id: 1, code: 1 }).toArray();
      const ids = roles.map((role) => role._id);
      if (!ids.length) return { data: [] };
      const roleMap = new Map(roles.map((role) => [role._id.toString(), role.code]));
      const users = await repository.collection('users').find({ account_status: 'active', $or: [
        { primary_role_id: { $in: ids } }, { additional_role_ids: { $in: ids } },
      ] }).project({ full_name: 1, email: 1, phone: 1, primary_role_id: 1 }).sort({ full_name: 1 }).toArray();
      return { data: users.map((user) => ({ id: user._id.toString(), name: user.full_name, email: user.email,
        phone: user.phone, role: roleMap.get(user.primary_role_id?.toString()) || 'OPERATION_STAFF' })) };
    },

    async listGarageStaff(query) {
      const parsed = parseOperationListQuery(query, { statuses: [] });
      const role = await repository.collection('roles').findOne({ code: 'GARAGE_STAFF', permissions: 'vehicle.inspect' });
      if (!role) return { data: [], pagination: pageInfo(parsed.page, parsed.limit, 0) };
      const filter = {
        account_status: 'active',
        $or: [{ primary_role_id: role._id }, { additional_role_ids: role._id }],
      };
      if (parsed.q) filter.$or = [
        { primary_role_id: role._id },
        { additional_role_ids: role._id },
        { full_name: { $regex: escaped(parsed.q), $options: 'i' } },
        { email: { $regex: escaped(parsed.q), $options: 'i' } },
      ];
      const [users, total] = await Promise.all([
        repository.findMany('users', filter, { ...parsed, sortBy: { full_name: 1, _id: 1 } }),
        repository.count('users', filter),
      ]);
      return {
        data: users.map((user) => ({ id: user._id.toString(), name: user.full_name, email: user.email, phone: user.phone })),
        pagination: pageInfo(parsed.page, parsed.limit, total),
      };
    },

    async listVehicles(query) {
      const parsed = parseOperationListQuery(query, { statuses: ['submitted', 'revision_required', 'pending_review'] });
      const filter = parsed.status === 'all' ? { onboarding_status: { $in: ['submitted', 'revision_required', 'pending_review'] } } : { onboarding_status: parsed.status };
      if (parsed.q) filter.$or = ['brand', 'model', 'license_plate'].map((field) => ({
        [field]: { $regex: escaped(parsed.q), $options: 'i' },
      }));
      const [vehicles, total] = await Promise.all([
        repository.findMany('vehicles', filter, { ...parsed, sortBy: { updated_at: -1, _id: -1 } }),
        repository.count('vehicles', filter),
      ]);
      const owners = await joinUsers(vehicles.map((vehicle) => vehicle.owner_id));
      const vehicleIds = vehicles.map((vehicle) => vehicle._id);
      const inspections = vehicleIds.length ? await repository.collection('vehicle_inspections').find({
        vehicle_id: { $in: vehicleIds }, inspection_type: 'onboarding', approval_status: { $in: ['draft', 'pending'] },
      }).toArray() : [];
      const inspectionByVehicle = new Map(inspections.map((inspection) => [inspection.vehicle_id.toString(), inspection]));
      return {
        data: vehicles.map((vehicle) => {
          const inspection = inspectionByVehicle.get(vehicle._id.toString());
          return {
            id: vehicle._id.toString(),
            brand: vehicle.brand,
            model: vehicle.model,
            licensePlate: vehicle.license_plate,
            year: vehicle.manufacture_year,
            onboardingStatus: vehicle.onboarding_status,
            physicalStatus: vehicle.physical_status,
            owner: owners.get(vehicle.owner_id?.toString()) || null,
            documents: {
              registration: Boolean(vehicle.documents?.registration?.file_key),
              inspectionCertificate: Boolean(vehicle.documents?.inspection_certificate?.file_key),
              insurance: Boolean(vehicle.documents?.insurance?.file_key),
            },
            inspection: inspection ? {
              id: inspection._id.toString(),
              status: inspection.approval_status,
              garageStaffId: inspection.garage_staff_id.toString(),
              scheduledFor: inspection.scheduled_for || null,
              note: inspection.schedule_note || '',
            } : null,
            reviewNote: vehicle.review_note || '',
            createdAt: vehicle.created_at,
            updatedAt: vehicle.updated_at,
          };
        }),
        pagination: pageInfo(parsed.page, parsed.limit, total),
      };
    },

    async getVehicle(idValue) {
      const vehicle = await repository.findById('vehicles', toId(idValue));
      if (!vehicle) throw httpError(404, 'Không tìm thấy hồ sơ xe.');
      const ownerMap = await joinUsers([vehicle.owner_id]);
      return { data: {
        id: vehicle._id.toString(),
        brand: vehicle.brand,
        model: vehicle.model,
        licensePlate: vehicle.license_plate,
        year: vehicle.manufacture_year,
        onboardingStatus: vehicle.onboarding_status,
        physicalStatus: vehicle.physical_status,
        owner: ownerMap.get(vehicle.owner_id?.toString()) || null,
        documents: {
          registration: vehicle.documents?.registration || null,
          inspectionCertificate: vehicle.documents?.inspection_certificate || null,
          insurance: vehicle.documents?.insurance || null,
        },
        photos: vehicle.photos || [],
        reviewNote: vehicle.review_note || '',
        registrationHistory: vehicle.registration_history || [],
      } };
    },

    async screenVehicle(request, idValue, body) {
      const id = toId(idValue);
      const input = parseVehicleScreen(body);
      const vehicle = await repository.findById('vehicles', id);
      if (!vehicle || !['submitted', 'revision_required', 'pending_review'].includes(vehicle.onboarding_status))
        throw httpError(409, 'Hồ sơ xe không còn ở trạng thái Operation cần sàng lọc.');
      const now = new Date();
      if (input.action === 'request_revision') {
        const result = await repository.updateOne('vehicles', {
          _id: id, onboarding_status: vehicle.onboarding_status,
        }, {
          $set: { onboarding_status: 'revision_required', review_note: input.note, updated_at: now },
          $push: { registration_history: { action: 'revision_requested', by_user_id: actorId(request), at: now, note: input.note } },
        });
        if (!result.modifiedCount) throw httpError(409, 'Hồ sơ xe vừa được cập nhật.');
      } else {
        if (!['with_owner', 'returned_to_owner'].includes(vehicle.physical_status))
          throw httpError(409, 'Chỉ lên lịch kiểm định đầu vào khi xe đang ở chủ xe.');
        const staff = await repository.collection('users').findOne({ _id: input.garageStaffId, account_status: 'active' });
        if (!staff) throw httpError(404, 'Không tìm thấy Garage Staff đang hoạt động.');
        const roleIds = [staff.primary_role_id, ...(staff.additional_role_ids || [])].filter(Boolean);
        const roles = await repository.collection('roles').find({ _id: { $in: roleIds } }).project({ code: 1, permissions: 1 }).toArray();
        if (!roles.some((role) => role.code === 'GARAGE_STAFF' && role.permissions?.includes('vehicle.inspect')))
          throw httpError(400, 'Chỉ phân công kiểm định cho Garage Staff có quyền vehicle.inspect.');
        const existing = await repository.collection('vehicle_inspections').findOne({
          vehicle_id: id, inspection_type: 'onboarding', approval_status: { $in: ['draft', 'pending'] },
        });
        if (existing) throw httpError(409, 'Xe đã có biên bản kiểm định đang mở.');
        try {
          await repository.insertOne('vehicle_inspections', {
            _id: new ObjectId(),
            vehicle_id: id,
            garage_staff_id: input.garageStaffId,
            inspection_type: 'onboarding',
            approval_status: 'draft',
            version: 0,
            condition_report: {},
            scheduled_for: input.scheduledFor,
            schedule_note: input.note,
            assigned_by_operation_staff_id: actorId(request),
            created_at: now,
            updated_at: now,
          });
        } catch (error) {
          if (error.code === 11000) throw httpError(409, 'Xe đã có biên bản kiểm định đang mở.');
          throw error;
        }
      }
      await audit(request, `vehicle.${input.action}`, 'vehicles', id, {
        note: input.note,
        ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
        ...(input.garageStaffId ? { garageStaffId: input.garageStaffId.toString() } : {}),
      });
      return { data: { id: id.toString(), action: input.action, ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}) } };
    },

    // Case queue endpoints: Operation investigates and prepares cases for the responsible approver.
    listIncidents: (request) => listCases(request, 'incident'),
    listViolations: (request) => listCases(request, 'traffic_violation'),
    listDisputes: (request) => listCases(request, 'dispute'),
    listComplaints: (request) => listCases(request, 'complaint'),

    // Case handling: Operation gathers evidence, assigns investigators, and submits recommendations.
    async createIncident(request, body) {
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'body phải là object.');
      const { caseType, description, bookingId, vehicleId } = body;
      if (typeof description !== 'string' || !description.trim() || description.trim().length > 3000) throw httpError(400, 'description là bắt buộc (tối đa 3000 ký tự).');
      if (!['damage', 'accident', 'safety', 'other', 'overdue', 'traffic_violation'].includes(caseType)) throw httpError(400, 'caseType không hợp lệ.');
      const bookingRef = bookingId ? toId(bookingId, 'bookingId') : null;
      const booking = bookingRef ? await repository.findById('bookings', bookingRef) : null;
      if (bookingRef && !booking) throw httpError(404, 'Không tìm thấy booking được liên kết.');
      const vehicleRef = vehicleId ? toId(vehicleId, 'vehicleId') : booking?.vehicle_id || null;
      if (!vehicleRef) throw httpError(400, 'Cần vehicleId hoặc bookingId có liên kết với xe.');
      if (vehicleRef && !(await repository.findById('vehicles', vehicleRef))) throw httpError(404, 'Không tìm thấy xe được liên kết.');
      const now = new Date();
      const doc = { _id: new ObjectId(), case_number: `CASE-${now.getFullYear()}-${new ObjectId().toString().slice(-8).toUpperCase()}`,
        reported_by_user_id: actorId(request), assigned_operation_staff_id: actorId(request),
        ...(bookingRef ? { booking_id: bookingRef } : {}), ...(vehicleRef ? { vehicle_id: vehicleRef } : {}),
        case_type: caseType, description: description.trim(), evidence: [], investigation: { review_status: 'pending' },
        ...(caseType === 'traffic_violation' ? { traffic_violation_details: { reported_at: now, official_confirmation: 'not_confirmed', fine_amount_claimed: 0 } } : { traffic_violation_details: null }),
        compensation_claims: [], status: 'reported', created_at: now, updated_at: now,
        operation_timeline: [{ action: 'incident.created', note: '', actor_user_id: actorId(request), at: now }],
      };
      await repository.insertOne('incident_cases', doc);
      await audit(request, 'incident.create', 'incident_cases', doc._id, { caseType });
      return { data: { id: doc._id.toString(), caseNumber: doc.case_number, status: doc.status } };
    },

    async updateCase(request, idValue, body, expectedType) {
      const id = toId(idValue);
      const changes = parseCaseUpdate(body);
      const current = await repository.findById('incident_cases', id);
      if (!current || (expectedType && current.case_type !== expectedType)) throw httpError(404, 'Không tìm thấy hồ sơ.');
      if (changes.status !== undefined && current.status === 'pending_manager')
        throw httpError(403, 'Hồ sơ đã được chuyển cho Manager và không thể đổi trạng thái bởi Operation Staff.');
      if (changes.status !== undefined) transition(current.status, changes.status, { dispute: current.case_type === 'dispute' });
      if (changes.status && ['complaint', 'dispute', 'traffic_violation'].includes(current.case_type)
        && ['resolved', 'closed'].includes(changes.status))
        throw httpError(403, 'Operation Staff chỉ lập hồ sơ và đề xuất; Manager quyết định khiếu nại, tranh chấp hoặc phạt nguội.');
      if (changes.status && ['resolved', 'closed'].includes(changes.status)
        && (current.compensation_claims || []).some((claim) => !claim.decision || claim.decision === 'pending'))
        throw httpError(403, 'Yêu cầu bồi thường đang chờ Manager quyết định.');
      if (changes.assigned_operation_staff_id) {
        const assignee = await repository.collection('users').findOne({ _id: changes.assigned_operation_staff_id, account_status: 'active' });
        if (!assignee) throw httpError(404, 'Không tìm thấy nhân sự đang hoạt động.');
        const roleIds = [assignee.primary_role_id, ...(assignee.additional_role_ids || [])].filter(Boolean);
        const roles = await repository.collection('roles').find({ _id: { $in: roleIds } }).project({ code: 1 }).toArray();
        if (!roles.some(({ code }) => ['OPERATION_STAFF', 'ADMIN'].includes(code))) throw httpError(400, 'Chỉ có thể phân công cho Operation Staff hoặc Admin.');
      }
      const now = new Date();
      const set = { updated_at: now, handled_by: actorId(request), handled_at: now };
      const timeline = [];
      if (changes.status !== undefined) { set.status = changes.status; timeline.push({ action: 'status.update', status: changes.status, note: changes.note || '', actor_user_id: actorId(request), at: now }); }
      if (changes.assigned_operation_staff_id !== undefined) { set.assigned_operation_staff_id = changes.assigned_operation_staff_id; timeline.push({ action: 'case.assign', note: changes.note || '', actor_user_id: actorId(request), at: now }); }
      if (changes.evidence !== undefined) set.evidence = [...(current.evidence || []), ...changes.evidence.map((item) => ({ ...item, uploaded_by_user_id: actorId(request), uploaded_at: now }))];
      if (changes.status === 'resolved' || changes.status === 'closed') set.resolution = { ...(current.resolution || {}), outcome: changes.status, note: changes.note || '', resolved_at: now };
      if (changes.note && !changes.status && changes.assigned_operation_staff_id === undefined) timeline.push({ action: 'case.note', note: changes.note, actor_user_id: actorId(request), at: now });
      if (changes.status !== undefined && ['complaint', 'dispute'].includes(current.case_type)) set['investigation.review_status'] = changes.status;
      if (changes.evidence?.length) timeline.push({ action: 'case.evidence', note: `${changes.evidence.length} tệp chứng cứ`, actor_user_id: actorId(request), at: now });
      const result = await repository.updateOne('incident_cases', { _id: id, status: current.status }, { $set: set, ...(timeline.length ? { $push: { operation_timeline: { $each: timeline } } } : {}) });
      if (!result.modifiedCount) throw httpError(409, 'Hồ sơ vừa được cập nhật. Vui lòng tải lại.');
      await audit(request, 'case.update', 'incident_cases', id, { status: changes.status || current.status });
      return { data: { id: id.toString(), status: changes.status || current.status } };
    },

    async reviewViolation(request, idValue, body) {
      const id = toId(idValue);
      const decision = parseViolationDecision(body);
      const current = await repository.findById('incident_cases', id);
      if (!current || current.case_type !== 'traffic_violation') throw httpError(404, 'Không tìm thấy vi phạm.');
      if (!['reported', 'investigating', 'in_progress', 'under_review', 'awaiting_response'].includes(current.status))
        throw httpError(409, 'Vi phạm không còn ở trạng thái chờ Operation xử lý.');
      const now = new Date();
      const status = 'pending_manager';
      const set = { status, updated_at: now, handled_by: actorId(request), handled_at: now,
        'traffic_violation_details.official_confirmation': 'pending_manager_review',
        'traffic_violation_details.reviewed_by_operation_staff_id': actorId(request),
        'traffic_violation_details.reviewed_at': now,
        'traffic_violation_details.operation_recommendation': decision.decision,
        'traffic_violation_details.operation_recommended_penalty_fee': decision.penalty_fee || 0,
        'traffic_violation_details.operation_review_note': decision.note };
      const result = await repository.updateOne('incident_cases', { _id: id, status: current.status }, { $set: set,
        $push: { operation_timeline: { action: `violation.${decision.decision}`, note: decision.note, actor_user_id: actorId(request), at: now } } });
      if (!result.modifiedCount) throw httpError(409, 'Vi phạm vừa được cập nhật. Vui lòng tải lại.');
      await audit(request, 'violation.submit_for_manager_review', 'incident_cases', id, {
        recommendation: decision.decision, proposedPenaltyFee: decision.penalty_fee || 0, note: decision.note,
      });
      return { data: { id: id.toString(), status, recommendation: decision.decision } };
    },

    async getCase(idValue, expectedType) {
      const row = await repository.findById('incident_cases', toId(idValue));
      if (!row || (expectedType && row.case_type !== expectedType)) throw httpError(404, 'Không tìm thấy hồ sơ.');
      return { data: (await caseRows([row]))[0] };
    },

    // Overdue rentals: remind the renter, record contact outcomes, or escalate after four hours.
    async listOverdue(query) {
      const parsed = parseOperationListQuery(query, { statuses: ['ongoing'], defaultStatus: 'ongoing' });
      const now = new Date();
      const filter = { status: 'ongoing', end_at: { $lt: now }, actual_end_at: null };
      if (parsed.q) filter.booking_code = { $regex: escaped(parsed.q), $options: 'i' };
      const [rows, total] = await Promise.all([
        repository.findMany('bookings', filter, { ...parsed, sortBy: { end_at: 1, _id: 1 } }), repository.count('bookings', filter),
      ]);
      const mapped = await bookingRows(rows);
      return { data: mapped.map((row) => {
        const source = rows.find((item) => item._id.toString() === row.id);
        const overdueHours = Math.max(0, Math.ceil((now - new Date(row.endAt) - OVERDUE_GRACE_PERIOD_MS) / 3600000));
        return {
          ...row,
          overdueHours,
          lateFeeEstimate: overdueHours * row.lateFeePerHour,
          handledAt: source?.operation_overdue_handled_at || null,
          escalatedAt: source?.operation_overdue_escalated_at || null,
          canEscalate: now.getTime() - new Date(row.endAt).getTime() >= OVERDUE_ESCALATION_WINDOW_MS,
        };
      }), pagination: pageInfo(parsed.page, parsed.limit, total) };
    },

    async overdueAction(request, idValue, body) {
      const id = toId(idValue);
      const action = parseOverdueAction(body);
      const now = new Date();
      const booking = await repository.findById('bookings', id);
      if (!booking || booking.status !== 'ongoing' || !booking.end_at || booking.end_at >= now || booking.actual_end_at)
        throw httpError(409, 'Booking này hiện không quá hạn.');
      if (action.action === 'escalate' && now.getTime() - booking.end_at.getTime() < OVERDUE_ESCALATION_WINDOW_MS)
        throw httpError(409, 'Chỉ chuyển Manager khi đã quá hạn ít nhất 4 giờ và không liên hệ được renter.');
      if (action.action === 'escalate' && booking.operation_overdue_escalated_at)
        throw httpError(409, 'Booking quá hạn này đã được chuyển Manager.');
      if (action.action === 'remind') {
        await repository.insertOne('notifications', { _id: new ObjectId(), recipient_user_id: booking.renter_id,
          notification_type: 'overdue_rental_reminder', title: 'Nhắc trả xe quá hạn', content: action.note || `Booking ${booking.booking_code} đã quá thời gian trả xe.`,
          related_entity_type: 'booking', related_entity_id: id,
          delivery_channels: { in_app: { status: 'pending' }, email: { status: 'not_requested' } },
          is_read: false, created_at: now, read_at: null });
      } else if (action.action === 'handled') {
        const result = await repository.updateOne('bookings', { _id: id, status: 'ongoing', actual_end_at: null }, { $set: {
          operation_overdue_handled_at: now, operation_overdue_handled_by: actorId(request), operation_overdue_note: action.note || '', updated_at: now,
        } });
        if (!result.modifiedCount) throw httpError(409, 'Booking quá hạn vừa được cập nhật hoặc xe đã được trả.');
      } else {
        const vehicles = await repository.collection('vehicles').findOne({ _id: booking.vehicle_id });
        const roleRows = await repository.collection('roles').find({ code: { $in: ['MANAGER'] } }).project({ _id: 1 }).toArray();
        const managerRoleIds = roleRows.map((role) => role._id);
        const managers = managerRoleIds.length ? await repository.collection('users').find({
          account_status: 'active',
          $or: [{ primary_role_id: { $in: managerRoleIds } }, { additional_role_ids: { $in: managerRoleIds } }],
        }).project({ _id: 1 }).toArray() : [];
        if (!managers.length) throw httpError(409, 'Không tìm thấy Manager đang hoạt động để nhận bàn giao.');
        const recipients = [...new Map([
          ...(vehicles?.owner_id ? [[vehicles.owner_id.toString(), vehicles.owner_id]] : []),
          ...managers.map((manager) => [manager._id.toString(), manager._id]),
        ]).values()];
        const result = await repository.updateOne('bookings', {
          _id: id, status: 'ongoing', actual_end_at: null, operation_overdue_escalated_at: { $exists: false },
        }, { $set: {
          operation_overdue_escalated_at: now,
          operation_overdue_escalated_by: actorId(request),
          operation_overdue_note: action.note || 'Không liên hệ được renter sau 4 giờ quá hạn.',
          updated_at: now,
        } });
        if (!result.modifiedCount) throw httpError(409, 'Booking vừa được chuyển Manager hoặc xe đã được trả.');
        await Promise.all(recipients.map((recipient_user_id) => repository.insertOne('notifications', {
          _id: new ObjectId(),
          recipient_user_id,
          notification_type: 'overdue_rental_escalation',
          title: 'Booking quá hạn cần Manager xử lý',
          content: `Booking ${booking.booking_code} đã quá hạn ít nhất 4 giờ; Operation không liên hệ được renter.`,
          related_entity_type: 'booking',
          related_entity_id: id,
          delivery_channels: { in_app: { status: 'pending' }, email: { status: 'not_requested' } },
          is_read: false,
          created_at: now,
          read_at: null,
        })));
      }
      await audit(request, `overdue.${action.action}`, 'bookings', id, { note: action.note || '' });
      return { data: { id: id.toString(), action: action.action, handledAt: action.action === 'handled' ? now : null } };
    },
  };
}
