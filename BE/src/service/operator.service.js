import { Types } from 'mongoose';
import { httpError, objectId } from '../utils/http-error.js';
import { vehicleDocumentContentType } from '../utils/image-content.js';
import { findPageRows } from '../utils/pagination.js';
import { escapeRegExp } from '../utils/regex.js';
import { garageTransaction } from '../utils/garage-transaction.js';
import {
  parseIncidentCreate,
  parseIncidentEvidence,
  parseIncidentUpdate,
  parseOperatorListQuery,
  parseVehicleInspectionAssignment,
  parseVehicleInspectionReschedule,
  parseVehicleStatusUpdate,
} from '../validators/operator.validator.js';

const { ObjectId } = Types;
const OPEN_CASES = ['reported', 'open', 'investigating', 'in_progress', 'under_review', 'awaiting_response', 'pending_manager', 'pending_review', 'need_more_information', 'escalated'];
const INCIDENT_FILTER_STATUSES = [...OPEN_CASES, 'resolved', 'closed'];
const PHYSICAL_STATUSES = ['with_owner', 'at_garage', 'rented', 'returned_to_owner', 'maintenance'];
const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const OPEN_INSPECTION_STATUSES = ['draft', 'pending'];
const PHYSICAL_STATUS_TRANSITIONS = {
  with_owner: ['maintenance'],
  at_garage: ['maintenance'],
  maintenance: ['at_garage'],
  rented: [],
  returned_to_owner: [],
};
const INSPECTION_ELIGIBLE_ONBOARDING_STATUSES = ['submitted', 'pending_review', 'revision_required'];
const ACTIVE_INCIDENT_BOOKING_STATUSES = ['confirmed', 'ongoing', 'completed'];
const DASHBOARD_INSPECTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function createOperatorService(repository, files) {
  const actorId = (request) => new ObjectId(objectId(request.tokenPayload.sub, 'userId'));
  async function audit(request, action, entityType, entityId, changes = {}, session) {
    await repository.auditLogs.create({
      actor_user_id: actorId(request),
      action,
      entity_type: entityType,
      entity_id: entityId,
      sanitized_changes: changes,
      created_at: new Date(),
    }, session ? { session } : {});
  }

  function optimisticFilter(record, statusField) {
    const filter = { _id: record._id };
    if (statusField) filter[statusField] = record[statusField];
    if (record.updated_at === undefined) filter.updated_at = { $exists: false };
    else filter.updated_at = record.updated_at;
    return filter;
  }

  async function usersById(ids) {
    const unique = [...new Map(ids.filter(Boolean).map((id) => [id.toString(), id])).values()];
    if (!unique.length) return new Map();
    const users = await repository.users.find(
      { _id: { $in: unique } },
      { projection: { full_name: 1, email: 1 } },
    ).exec();
    return new Map(users.map((user) => [user._id.toString(), user]));
  }

  function inspectionSummary(inspection, garageStaff) {
    const scheduledFor = inspection.scheduled_for || null;
    const now = new Date();
    let scheduleState = 'completed';
    if (inspection.approval_status === 'pending') scheduleState = 'awaiting_manager';
    else if (inspection.approval_status === 'draft') {
      if (!scheduledFor) scheduleState = 'unscheduled';
      else if (scheduledFor < now) scheduleState = 'overdue';
      else if (scheduledFor <= new Date(now.getTime() + DASHBOARD_INSPECTION_WINDOW_MS)) scheduleState = 'upcoming';
      else scheduleState = 'scheduled';
    }
    return {
      id: inspection._id.toString(),
      status: inspection.approval_status,
      scheduleState,
      scheduledFor,
      scheduleNote: inspection.schedule_note || '',
      garageStaffId: inspection.garage_staff_id?.toString() || null,
      garageStaff: garageStaff || null,
      version: inspection.version ?? 0,
    };
  }

  function vehicleSummary(vehicle, owners, inspection, garageStaff) {
    return {
      id: vehicle._id.toString(),
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      licensePlate: vehicle.license_plate || '',
      year: vehicle.manufacture_year ?? null,
      physicalStatus: vehicle.physical_status || '',
      onboardingStatus: vehicle.onboarding_status || '',
      owner: owners.get(vehicle.owner_id?.toString()) || null,
      updatedAt: vehicle.updated_at || null,
      inspection: inspection ? inspectionSummary(inspection, garageStaff) : null,
    };
  }

  async function assignableGarageStaff(staffId, session) {
    const options = session ? { session } : {};
    const staff = await repository.users.findOne({
      _id: staffId,
      account_status: 'active',
    }, options);
    if (!staff) throw httpError(404, 'Không tìm thấy Garage Staff đang hoạt động.');

    const roleIds = [staff.primary_role_id, ...(staff.additional_role_ids || [])].filter(Boolean);
    const roles = await repository.roles.find({ _id: { $in: roleIds } }, options).exec();
    const isGarageStaff = roles.some((role) => role.code === 'GARAGE_STAFF');
    const canInspect = roles.some((role) => role.permissions?.includes('vehicle.inspect'));
    if (!isGarageStaff || !canInspect) {
      throw httpError(400, 'Chỉ phân công cho Garage Staff có quyền vehicle.inspect.');
    }
    return staff;
  }

  function incidentSummary(incident, vehicles) {
    const vehicle = vehicles.get(incident.vehicle_id?.toString());
    return {
      id: incident._id.toString(),
      caseNumber: incident.case_number,
      caseType: incident.case_type,
      status: incident.status,
      description: incident.description,
      severity: incident.severity || null,
      incidentType: incident.incident_type || null,
      vehicle: vehicle ? {
        id: vehicle._id.toString(),
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        licensePlate: vehicle.license_plate || '',
      } : null,
      bookingId: incident.booking_id?.toString() || null,
      location: incident.location || null,
      odometerKm: incident.odometer_km ?? null,
      evidence: (incident.evidence || []).map((item, index) => ({
        index,
        kind: item.kind || 'document',
        name: item.file_name || 'Biên bản',
        fileKey: item.file_key || '',
        contentType: item.content_type || null,
        isGaragePhoto: item.file_key?.startsWith('garage-photos/') || false,
        uploadedAt: item.uploaded_at || null,
      })),
      investigation: incident.investigation || {},
      trafficViolationDetails: incident.traffic_violation_details || null,
      compensationClaims: incident.compensation_claims || [],
      resolution: incident.resolution || null,
      timeline: incident.operation_timeline || [],
      createdAt: incident.created_at || null,
      updatedAt: incident.updated_at || null,
    };
  }

  return {
    async dashboard({ permissions = [], isAdmin = false } = {}) {
      const now = new Date();
      const expiresBefore = new Date(now.getTime() + EXPIRY_WINDOW_MS);
      const hasPermission = (permission) => isAdmin || permissions.includes(permission);
      const metrics = {};

      if (hasPermission('operation.vehicle.read')) {
        metrics.activeVehicles = await repository.vehicles.countDocuments({ physical_status: 'rented' });
      }
      if (hasPermission('operation.contract.read')) {
        const [managementAgreements, rentalAgreements] = await Promise.all([
          repository.managementAgreements.countDocuments({
            status: 'active',
            end_date: { $gte: now, $lte: expiresBefore },
          }),
          repository.rentalAgreements.countDocuments({
            status: 'signed',
            'terms_snapshot.end_at': { $gte: now, $lte: expiresBefore },
          }),
        ]);
        metrics.expiringContracts = managementAgreements + rentalAgreements;
      }
      if (hasPermission('operation.incident.read')) {
        const [incidentsInProgress, incidentsNeedsOperatorAction, incidentsWaitingManager] = await Promise.all([
          repository.incidents.countDocuments({ status: { $in: ['open', 'investigating', 'in_progress', 'under_review', 'awaiting_response'] } }),
          repository.incidents.countDocuments({ status: { $in: ['reported', 'need_more_information'] } }),
          repository.incidents.countDocuments({ status: { $in: ['pending_manager', 'pending_review', 'escalated'] } }),
        ]);
        Object.assign(metrics, { incidentsInProgress, incidentsNeedsOperatorAction, incidentsWaitingManager });
      }
      if (hasPermission('operation.vehicle.inspection.schedule')) {
        const candidates = await repository.vehicles.find({
          onboarding_status: { $in: INSPECTION_ELIGIBLE_ONBOARDING_STATUSES },
          physical_status: { $in: ['with_owner', 'returned_to_owner'] },
        }, { projection: { _id: 1 } }).exec();
        const candidateIds = candidates.map((vehicle) => vehicle._id);
        const [openInspections, inspectionsUpcoming, inspectionsOverdue, inspectionsAwaitingManager] = await Promise.all([
          candidateIds.length
            ? repository.vehicleInspections.find({
              vehicle_id: { $in: candidateIds },
              inspection_type: 'onboarding',
              approval_status: { $in: OPEN_INSPECTION_STATUSES },
            }, { projection: { vehicle_id: 1 } }).exec()
            : [],
          repository.vehicleInspections.countDocuments({
            inspection_type: 'onboarding',
            approval_status: 'draft',
            scheduled_for: { $gte: now, $lte: new Date(now.getTime() + DASHBOARD_INSPECTION_WINDOW_MS) },
          }),
          repository.vehicleInspections.countDocuments({
            inspection_type: 'onboarding',
            approval_status: 'draft',
            scheduled_for: { $lt: now },
          }),
          repository.vehicleInspections.countDocuments({
            inspection_type: 'onboarding',
            approval_status: 'pending',
          }),
        ]);
        const assignedVehicleIds = new Set(openInspections.map((inspection) => inspection.vehicle_id.toString()));
        Object.assign(metrics, {
          vehiclesAwaitingInspection: candidates.filter((vehicle) => !assignedVehicleIds.has(vehicle._id.toString())).length,
          inspectionsUpcoming,
          inspectionsOverdue,
          inspectionsAwaitingManager,
        });
      }
      return {
        data: { metrics },
      };
    },

    async listVehicles(query) {
      const parsed = parseOperatorListQuery(query, PHYSICAL_STATUSES);
      const filter = {};
      if (parsed.status !== 'all') filter.physical_status = parsed.status;
      if (parsed.q) {
        const pattern = new RegExp(escapeRegExp(parsed.q), 'i');
        filter.$or = ['brand', 'model', 'license_plate'].map((field) => ({ [field]: pattern }));
      }
      const rows = await findPageRows(repository.vehicles, filter, query, { sort: { updated_at: -1 } });
      const vehicleIds = rows.map((vehicle) => vehicle._id);
      const inspections = vehicleIds.length
        ? await repository.vehicleInspections.aggregate([
          { $match: { vehicle_id: { $in: vehicleIds }, inspection_type: 'onboarding' } },
          { $sort: { created_at: -1, _id: -1 } },
          { $group: { _id: '$vehicle_id', inspection: { $first: '$$ROOT' } } },
          { $replaceRoot: { newRoot: '$inspection' } },
        ]).exec()
        : [];
      const inspectionByVehicle = new Map();
      for (const inspection of inspections) {
        if (!inspectionByVehicle.has(inspection.vehicle_id.toString())) {
          inspectionByVehicle.set(inspection.vehicle_id.toString(), inspection);
        }
      }
      const staffIds = [...inspectionByVehicle.values()].map((inspection) => inspection.garage_staff_id);
      const users = await usersById([...rows.map((vehicle) => vehicle.owner_id), ...staffIds]);
      return {
        data: rows.map((vehicle) => vehicleSummary(
          vehicle,
          users,
          inspectionByVehicle.get(vehicle._id.toString()),
          users.get(inspectionByVehicle.get(vehicle._id.toString())?.garage_staff_id?.toString()) || null,
        )),
        pagination: rows.pagination,
      };
    },

    async getVehicle(idValue) {
      const id = new ObjectId(objectId(idValue));
      const vehicle = await repository.vehicles.findOne({ _id: id });
      if (!vehicle) throw httpError(404, 'Không tìm thấy xe.');
      const inspection = await repository.vehicleInspections.findOne({
        vehicle_id: id,
        inspection_type: 'onboarding',
      }, { sort: { created_at: -1, _id: -1 } });
      const users = await usersById([vehicle.owner_id, inspection?.garage_staff_id]);
      return {
        data: {
          ...vehicleSummary(
            vehicle,
            users,
            inspection,
            users.get(inspection?.garage_staff_id?.toString()) || null,
          ),
          vin: vehicle.vin || '',
          seats: vehicle.seats ?? null,
          fuelType: vehicle.fuel_type || '',
          transmission: vehicle.transmission || '',
          vehicleType: vehicle.vehicle_type || '',
          description: vehicle.description || '',
          documents: {
            registration: Boolean(vehicle.documents?.registration?.file_key),
            inspectionCertificate: Boolean(vehicle.documents?.inspection_certificate?.file_key),
            insurance: Boolean(vehicle.documents?.insurance?.file_key),
          },
          statusHistory: vehicle.operational_status_history || [],
        },
      };
    },

    async listGarageStaff() {
      const [garageRole, roles] = await Promise.all([
        repository.roles.findOne({ code: 'GARAGE_STAFF' }),
        repository.roles.find({}, { projection: { code: 1, permissions: 1 } }).exec(),
      ]);
      if (!garageRole) return { data: [] };
      const users = await repository.users.find({
        account_status: 'active',
        $or: [{ primary_role_id: garageRole._id }, { additional_role_ids: garageRole._id }],
      }, { projection: { full_name: 1, email: 1, phone: 1, primary_role_id: 1, additional_role_ids: 1 } }).sort({ full_name: 1, _id: 1 }).exec();
      const roleById = new Map(roles.map((role) => [role._id.toString(), role]));
      return {
        data: users.filter((user) => [user.primary_role_id, ...(user.additional_role_ids || [])]
          .filter(Boolean)
          .some((roleId) => roleById.get(roleId.toString())?.permissions?.includes('vehicle.inspect')))
          .map((user) => ({
            id: user._id.toString(),
            name: user.full_name,
            email: user.email,
            phone: user.phone,
          })),
      };
    },

    async readVehicleDocument(idValue, kind) {
      const documentFields = {
        registration: 'registration',
        inspectionCertificate: 'inspection_certificate',
        insurance: 'insurance',
      };
      const documentField = documentFields[kind];
      if (!documentField) throw httpError(404, 'Không tìm thấy tài liệu xe.');
      const id = new ObjectId(objectId(idValue));
      const vehicle = await repository.vehicles.findOne({ _id: id });
      const fileKey = vehicle?.documents?.[documentField]?.file_key;
      if (!fileKey) throw httpError(404, 'Không tìm thấy tài liệu xe.');
      const bytes = await files.read(fileKey);
      const contentType = vehicleDocumentContentType(bytes);
      if (!contentType) throw httpError(422, 'Tài liệu không phải PDF hoặc ảnh được hỗ trợ.');
      return { bytes, contentType };
    },

    async updateVehicleStatus(request, idValue, body) {
      const id = new ObjectId(objectId(idValue));
      const input = parseVehicleStatusUpdate(body);
      return garageTransaction(repository, async (session) => {
        const current = await repository.vehicles.findOne({ _id: id }, { session });
        if (!current) throw httpError(404, 'Không tìm thấy xe.');
        if (current.physical_status === input.status) {
          return { data: { id: id.toString(), physicalStatus: input.status, updatedAt: current.updated_at || null } };
        }
        if (!PHYSICAL_STATUS_TRANSITIONS[current.physical_status]?.includes(input.status)) {
          throw httpError(409, `Không thể chuyển trạng thái xe từ ${current.physical_status || 'không xác định'} sang ${input.status}.`);
        }
        if (input.status === 'at_garage' && current.onboarding_status !== 'approved') {
          throw httpError(409, 'Chỉ có thể đưa xe về trạng thái tại gara sau khi hồ sơ được Manager duyệt.');
        }

        const now = new Date();
        const history = {
          from: current.physical_status || null,
          to: input.status,
          note: input.note,
          changed_by_user_id: actorId(request),
          changed_at: now,
        };
        const result = await repository.vehicles.updateOne(
          optimisticFilter(current, 'physical_status'),
          {
            $set: { physical_status: input.status, updated_at: now },
            $push: { operational_status_history: history },
          },
          { session },
        );
        if (!result.modifiedCount) throw httpError(409, 'Trạng thái xe vừa được cập nhật. Vui lòng tải lại.');
        await audit(request, 'vehicle.operational_status.update', 'vehicles', id, {
          from: current.physical_status || null,
          to: input.status,
          reason: input.note,
        }, session);
        return { data: { id: id.toString(), physicalStatus: input.status, updatedAt: now } };
      });
    },

    async scheduleVehicleInspection(request, idValue, body) {
      const id = new ObjectId(objectId(idValue));
      const input = parseVehicleInspectionAssignment(body);
      await repository.vehicleInspections.ensureIndexes();
      try {
        return await garageTransaction(repository, async (session) => {
          const options = { session };
          const vehicle = await repository.vehicles.findOne({ _id: id }, options);
          if (!vehicle || !INSPECTION_ELIGIBLE_ONBOARDING_STATUSES.includes(vehicle.onboarding_status)) {
            throw httpError(409, 'Hồ sơ xe không còn chờ kiểm định đầu vào.');
          }
          if (!['with_owner', 'returned_to_owner'].includes(vehicle.physical_status)) {
            throw httpError(409, 'Chỉ lên lịch kiểm định đầu vào khi xe đang ở chủ xe.');
          }
          if (vehicle.condition_declaration && ['registration', 'inspection_certificate', 'insurance'].some((key) => !vehicle.documents?.[key]?.file_key)) {
            throw httpError(409, 'Cần đủ đăng ký xe, đăng kiểm và bảo hiểm trước khi lên lịch kiểm định.');
          }

          await assignableGarageStaff(input.garageStaffId, session);
          const existing = await repository.vehicleInspections.findOne({
            vehicle_id: id,
            inspection_type: 'onboarding',
            approval_status: { $in: OPEN_INSPECTION_STATUSES },
          }, options);
          if (existing) throw httpError(409, 'Xe đã có biên bản kiểm định đang mở.');

          const now = new Date();
          const inspection = await repository.vehicleInspections.create({
            vehicle_id: id,
            garage_staff_id: input.garageStaffId,
            inspection_type: 'onboarding',
            approval_status: 'draft',
            version: 0,
            condition_report: {},
            scheduled_for: input.scheduledFor,
            schedule_note: input.note,
            assigned_by_operator_staff_id: actorId(request),
            created_at: now,
            updated_at: now,
          }, options);
          await audit(request, 'vehicle.inspection.schedule', 'vehicle_inspections', inspection._id, {
            vehicle_id: id.toString(),
            garage_staff_id: input.garageStaffId.toString(),
            scheduled_for: input.scheduledFor,
          }, session);
          return {
            data: {
              id: inspection._id.toString(),
              vehicleId: id.toString(),
              status: inspection.approval_status,
              scheduledFor: inspection.scheduled_for,
              garageStaffId: input.garageStaffId.toString(),
              version: inspection.version,
            },
          };
        });
      } catch (error) {
        if (error.code === 11000) throw httpError(409, 'Xe đã có biên bản kiểm định đang mở.');
        throw error;
      }
    },

    async updateVehicleInspectionSchedule(request, idValue, body) {
      const vehicleId = new ObjectId(objectId(idValue));
      const input = parseVehicleInspectionReschedule(body);
      return garageTransaction(repository, async (session) => {
        const current = await repository.vehicleInspections.findOne({
          vehicle_id: vehicleId,
          inspection_type: 'onboarding',
          approval_status: 'draft',
        }, { session, sort: { created_at: -1, _id: -1 } });
        if (!current) throw httpError(409, 'Chỉ có thể đổi lịch hoặc Garage Staff khi biên bản còn là bản nháp.');
        if ((current.version ?? 0) !== input.version) {
          throw httpError(409, 'Lịch kiểm định vừa được cập nhật. Vui lòng tải lại.');
        }
        await assignableGarageStaff(input.garageStaffId, session);

        const now = new Date();
        const nextVersion = (current.version ?? 0) + 1;
        const result = await repository.vehicleInspections.updateOne(
          { ...optimisticFilter(current, 'approval_status'), version: input.version },
          {
            $set: {
              garage_staff_id: input.garageStaffId,
              scheduled_for: input.scheduledFor,
              schedule_note: input.note,
              assigned_by_operator_staff_id: actorId(request),
              updated_at: now,
              version: nextVersion,
            },
          },
          { session },
        );
        if (!result.modifiedCount) throw httpError(409, 'Lịch kiểm định vừa được cập nhật. Vui lòng tải lại.');
        await audit(request, 'vehicle.inspection.reschedule', 'vehicle_inspections', current._id, {
          vehicle_id: vehicleId.toString(),
          from: {
            garage_staff_id: current.garage_staff_id?.toString() || null,
            scheduled_for: current.scheduled_for || null,
          },
          to: {
            garage_staff_id: input.garageStaffId.toString(),
            scheduled_for: input.scheduledFor,
          },
          version: nextVersion,
        }, session);
        return {
          data: {
            id: current._id.toString(),
            vehicleId: vehicleId.toString(),
            status: 'draft',
            scheduledFor: input.scheduledFor,
            garageStaffId: input.garageStaffId.toString(),
            version: nextVersion,
          },
        };
      });
    },

    async listIncidents(request, query) {
      const parsed = parseOperatorListQuery(query, INCIDENT_FILTER_STATUSES);
      const filter = {};
      if (parsed.status !== 'all') filter.status = parsed.status;
      if (parsed.q) {
        const pattern = new RegExp(escapeRegExp(parsed.q), 'i');
        filter.$or = [{ case_number: pattern }, { description: pattern }];
      }
      const [rows, total] = await Promise.all([
        repository.incidents.find(filter).sort({ updated_at: -1, _id: -1 }).skip((parsed.page - 1) * parsed.limit).limit(parsed.limit).exec(),
        repository.incidents.countDocuments(filter),
      ]);
      const vehicles = await repository.vehicles.find(
        { _id: { $in: rows.map((row) => row.vehicle_id).filter(Boolean) } },
        { projection: { brand: 1, model: 1, license_plate: 1 } },
      ).exec();
      const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle._id.toString(), vehicle]));
      return {
        data: rows.map((row) => incidentSummary(row, vehicleMap)),
        pagination: { page: parsed.page, limit: parsed.limit, total, totalPages: Math.ceil(total / parsed.limit) },
      };
    },

    async getIncident(idValue) {
      const id = new ObjectId(objectId(idValue));
      const incident = await repository.incidents.findOne({ _id: id });
      if (!incident) throw httpError(404, 'Không tìm thấy hồ sơ sự cố.');
      const vehicle = incident.vehicle_id ? await repository.vehicles.findOne(
        { _id: incident.vehicle_id },
        { projection: { brand: 1, model: 1, license_plate: 1 } },
      ) : null;
      return { data: incidentSummary(incident, new Map(vehicle ? [[vehicle._id.toString(), vehicle]] : [])) };
    },

    async createIncident(request, body) {
      const input = parseIncidentCreate(body);
      const vehicleId = new ObjectId(input.vehicleId);
      const bookingId = input.bookingId ? new ObjectId(input.bookingId) : null;
      return garageTransaction(repository, async (session) => {
        const vehicle = await repository.vehicles.findOne({ _id: vehicleId }, { session, projection: { _id: 1 } });
        if (!vehicle) throw httpError(404, 'Không tìm thấy xe liên quan.');
        if (bookingId && !await repository.bookings.findOne({
          _id: bookingId,
          vehicle_id: vehicleId,
          status: { $in: ACTIVE_INCIDENT_BOOKING_STATUSES },
        }, { session, projection: { _id: 1 } })) {
          throw httpError(404, 'Không tìm thấy booking đang hoạt động hoặc đã hoàn tất của xe liên quan.');
        }
        const now = new Date();
        const id = new ObjectId();
        const caseNumber = `CASE-${now.getFullYear()}-${id.toString().slice(-8).toUpperCase()}`;
        const incident = await repository.incidents.create({
          _id: id,
          case_number: caseNumber,
          reported_by_user_id: actorId(request),
          assigned_operation_staff_id: actorId(request),
          vehicle_id: vehicleId,
          ...(bookingId ? { booking_id: bookingId } : {}),
          case_type: input.caseType,
          ...(input.incidentType ? { incident_type: input.incidentType } : {}),
          ...(input.location ? { location: input.location } : {}),
          ...(input.odometerKm !== undefined ? { odometer_km: input.odometerKm } : {}),
          ...(input.severity ? { severity: input.severity } : {}),
          description: input.description,
          status: 'reported',
          evidence: [],
          investigation: { review_status: 'recorded' },
          ...(input.caseType === 'traffic_violation' ? { traffic_violation_details: { reported_at: now, official_confirmation: 'not_confirmed' } } : {}),
          operation_timeline: [{ action: 'incident.recorded', note: '', actor_user_id: actorId(request), at: now }],
          created_at: now,
          updated_at: now,
        }, { session });
        await audit(request, 'incident.record', 'incident_cases', incident._id, {
          case_number: caseNumber,
          vehicle_id: vehicleId.toString(),
          booking_id: bookingId?.toString() || null,
        }, session);
        return { data: { id: incident._id.toString(), caseNumber, status: incident.status } };
      });
    },

    async updateIncident(request, idValue, body) {
      const id = new ObjectId(objectId(idValue));
      const changes = parseIncidentUpdate(body);
      return garageTransaction(repository, async (session) => {
        const current = await repository.incidents.findOne({ _id: id }, { session });
        if (!current) throw httpError(404, 'Không tìm thấy hồ sơ sự cố.');
        if (!['reported', 'need_more_information'].includes(current.status)) {
          throw httpError(403, 'Operator chỉ được cập nhật hồ sơ mới hoặc hồ sơ Manager yêu cầu bổ sung.');
        }
        if (changes.booking_id && !await repository.bookings.findOne({
          _id: changes.booking_id,
          vehicle_id: current.vehicle_id,
          status: { $in: ACTIVE_INCIDENT_BOOKING_STATUSES },
        }, { session, projection: { _id: 1 } })) {
          throw httpError(404, 'Booking phải thuộc đúng xe và đang hoạt động hoặc đã hoàn tất.');
        }

        const now = new Date();
        const set = { updated_at: now };
        for (const [key, value] of Object.entries(changes)) {
          if (key !== 'note') set[key] = value;
        }
        const changedFields = Object.keys(set).filter((key) => key !== 'updated_at');
        const result = await repository.incidents.updateOne(
          optimisticFilter(current, 'status'),
          {
            $set: set,
            $push: {
              operation_timeline: {
                action: 'incident.details.update',
                note: changes.note || '',
                actor_user_id: actorId(request),
                at: now,
              },
            },
          },
          { session },
        );
        if (!result.modifiedCount) throw httpError(409, 'Hồ sơ vừa được cập nhật. Vui lòng tải lại.');
        await audit(request, 'incident.update', 'incident_cases', id, {
          status: current.status,
          fields: changedFields,
        }, session);
        return { data: { id: id.toString(), status: current.status } };
      });
    },

    async submitIncident(request, idValue) {
      const id = new ObjectId(objectId(idValue));
      return garageTransaction(repository, async (session) => {
        const current = await repository.incidents.findOne({ _id: id }, { session });
        if (!current) throw httpError(404, 'Không tìm thấy hồ sơ sự cố.');
        if (!['reported', 'need_more_information'].includes(current.status)) {
          throw httpError(409, 'Chỉ có thể gửi hồ sơ mới hoặc hồ sơ Manager yêu cầu bổ sung.');
        }
        const now = new Date();
        const result = await repository.incidents.updateOne(
          optimisticFilter(current, 'status'),
          {
            $set: {
              status: 'pending_manager',
              assigned_operation_staff_id: actorId(request),
              'investigation.review_status': 'submitted',
              ...(current.case_type === 'traffic_violation' ? { 'traffic_violation_details.official_confirmation': 'pending_manager_review' } : {}),
              submitted_to_manager_by_user_id: actorId(request),
              submitted_to_manager_at: now,
              updated_at: now,
            },
            $push: { operation_timeline: { action: 'incident.submitted_to_manager', note: '', actor_user_id: actorId(request), at: now } },
          },
          { session },
        );
        if (!result.modifiedCount) throw httpError(409, 'Hồ sơ vừa được cập nhật. Vui lòng tải lại.');
        await audit(request, 'incident.submit_to_manager', 'incident_cases', id, { status: 'pending_manager' }, session);
        return { data: { id: id.toString(), status: 'pending_manager', submittedAt: now } };
      });
    },

    async attachEvidence(request, idValue, body) {
      const id = new ObjectId(objectId(idValue));
      const file = parseIncidentEvidence(body);
      if (vehicleDocumentContentType(file.bytes) !== file.contentType) {
        throw httpError(400, 'Định dạng tệp không khớp với nội dung.');
      }
      const incident = await repository.incidents.findOne({ _id: id });
      if (!incident) throw httpError(404, 'Không tìm thấy hồ sơ sự cố.');
      if (!['reported', 'need_more_information'].includes(incident.status)) {
        throw httpError(403, 'Operator chỉ được đính kèm biên bản cho hồ sơ mới hoặc hồ sơ Manager yêu cầu bổ sung.');
      }
      if ((incident.evidence || []).length >= 3) throw httpError(409, 'Mỗi hồ sơ đính kèm tối đa 3 biên bản.');

      const ownerId = actorId(request);
      const key = await files.save(ownerId, file, 'incident_evidence');
      try {
        const now = new Date();
        const evidence = {
          kind: 'document',
          file_key: key,
          file_name: file.name,
          content_type: file.contentType,
          uploaded_by_user_id: ownerId,
          uploaded_at: now,
        };
        const index = await garageTransaction(repository, async (session) => {
          const current = await repository.incidents.findOne({ _id: id }, { session });
          if (!current || !['reported', 'need_more_information'].includes(current.status)) {
            throw httpError(409, 'Hồ sơ vừa được gửi Manager hoặc đã kết thúc.');
          }
          if ((current.evidence || []).length >= 3) throw httpError(409, 'Mỗi hồ sơ đính kèm tối đa 3 biên bản.');
          const result = await repository.incidents.updateOne(
            { ...optimisticFilter(current, 'status'), 'evidence.3': { $exists: false } },
            { $push: { evidence }, $set: { updated_at: now } },
            { session },
          );
          if (!result.modifiedCount) throw httpError(409, 'Hồ sơ vừa được gửi Manager hoặc đã đạt giới hạn biên bản.');
          await audit(request, 'incident.evidence.attach', 'incident_cases', id, { content_type: file.contentType }, session);
          return current.evidence?.length || 0;
        });
        return { data: { index, name: file.name, uploadedAt: now } };
      } catch (error) {
        await files.remove([key]);
        throw error;
      }
    },

    async readEvidence(idValue, indexValue) {
      const id = new ObjectId(objectId(idValue));
      const index = Number(indexValue);
      if (!Number.isSafeInteger(index) || index < 0) throw httpError(400, 'Vị trí biên bản không hợp lệ.');
      const incident = await repository.incidents.findOne({ _id: id });
      const evidence = incident?.evidence?.[index];
      if (!evidence?.file_key) throw httpError(404, 'Không tìm thấy biên bản.');
      if (!evidence.file_key.startsWith('owner-files/') && !/^[a-f\d]{24}$/i.test(evidence.file_key)) {
        throw httpError(404, 'Không tìm thấy biên bản riêng tư.');
      }
      return {
        bytes: await files.read(evidence.file_key),
        contentType: evidence.content_type || 'application/octet-stream',
        fileName: evidence.file_name || `incident-${id}-${index}`,
      };
    },
  };
}
