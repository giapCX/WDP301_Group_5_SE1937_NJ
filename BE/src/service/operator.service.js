import { Types } from 'mongoose';
import { httpError, objectId } from '../utils/http-error.js';
import { vehicleDocumentContentType } from '../utils/image-content.js';
import { findPageRows } from '../utils/pagination.js';
import { escapeRegExp } from '../utils/regex.js';
import {
  parseIncidentCreate,
  parseIncidentEvidence,
  parseIncidentUpdate,
  parseOperatorListQuery,
  parseVehicleInspectionAssignment,
  parseVehicleStatusUpdate,
} from '../validators/operator.validator.js';

const { ObjectId } = Types;
const OPEN_CASES = ['reported', 'open', 'investigating', 'in_progress', 'under_review', 'awaiting_response', 'pending_manager', 'pending_review', 'need_more_information', 'escalated'];
const INCIDENT_FILTER_STATUSES = [...OPEN_CASES, 'resolved', 'closed'];
const PHYSICAL_STATUSES = ['with_owner', 'at_garage', 'rented', 'returned_to_owner', 'maintenance'];
const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CASE_STATUS_TRANSITIONS = {
  reported: ['investigating', 'in_progress', 'awaiting_response'],
  investigating: ['in_progress', 'awaiting_response'],
  in_progress: ['investigating', 'awaiting_response'],
  awaiting_response: ['investigating', 'in_progress'],
  open: ['investigating', 'in_progress', 'awaiting_response'],
  under_review: ['investigating', 'in_progress', 'awaiting_response'],
  need_more_information: ['investigating', 'in_progress', 'awaiting_response'],
};

export function createOperatorService(repository, files) {
  const actorId = (request) => new ObjectId(objectId(request.tokenPayload.sub, 'userId'));
  async function audit(request, action, entityType, entityId, changes = {}) {
    await repository.auditLogs.create({
      actor_user_id: actorId(request),
      action,
      entity_type: entityType,
      entity_id: entityId,
      sanitized_changes: changes,
      created_at: new Date(),
    });
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

  function vehicleSummary(vehicle, owners) {
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
    };
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
    async dashboard() {
      const now = new Date();
      const expiresBefore = new Date(now.getTime() + EXPIRY_WINDOW_MS);
      const [activeVehicles, managementAgreements, rentalAgreements, incidentsInProgress] = await Promise.all([
        repository.vehicles.countDocuments({ physical_status: 'rented' }),
        repository.managementAgreements.countDocuments({
          status: 'active',
          end_date: { $gte: now, $lte: expiresBefore },
        }),
        repository.rentalAgreements.countDocuments({
          status: 'signed',
          'terms_snapshot.end_at': { $gte: now, $lte: expiresBefore },
        }),
        repository.incidents.countDocuments({ status: { $in: OPEN_CASES } }),
      ]);
      return {
        data: {
          metrics: {
            activeVehicles,
            expiringContracts: managementAgreements + rentalAgreements,
            incidentsInProgress,
          },
        },
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
      const owners = await usersById(rows.map((vehicle) => vehicle.owner_id));
      return {
        data: rows.map((vehicle) => vehicleSummary(vehicle, owners)),
        pagination: rows.pagination,
      };
    },

    async getVehicle(idValue) {
      const id = new ObjectId(objectId(idValue));
      const vehicle = await repository.vehicles.findOne({ _id: id });
      if (!vehicle) throw httpError(404, 'Không tìm thấy xe.');
      const owners = await usersById([vehicle.owner_id]);
      const inspection = await repository.vehicleInspections.findOne({
        vehicle_id: id,
        inspection_type: 'onboarding',
        approval_status: { $in: ['draft', 'pending'] },
      }, { sort: { created_at: -1, _id: -1 } });
      return {
        data: {
          ...vehicleSummary(vehicle, owners),
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
          inspection: inspection ? {
            id: inspection._id.toString(),
            status: inspection.approval_status,
            scheduledFor: inspection.scheduled_for || null,
            scheduleNote: inspection.schedule_note || '',
            garageStaffId: inspection.garage_staff_id.toString(),
          } : null,
        },
      };
    },

    async listGarageStaff() {
      const role = await repository.roles.findOne({ code: 'GARAGE_STAFF' });
      if (!role?.permissions?.includes('vehicle.inspect')) return { data: [] };
      const users = await repository.users.find({
        account_status: 'active',
        $or: [{ primary_role_id: role._id }, { additional_role_ids: role._id }],
      }, { projection: { full_name: 1, email: 1, phone: 1 } }).sort({ full_name: 1, _id: 1 }).exec();
      return {
        data: users.map((user) => ({
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
      const current = await repository.vehicles.findOne({ _id: id });
      if (!current) throw httpError(404, 'Không tìm thấy xe.');
      if (current.physical_status === input.status) return { data: { id: id.toString(), physicalStatus: input.status } };

      const now = new Date();
      const history = {
        from: current.physical_status || null,
        to: input.status,
        note: input.note || '',
        changed_by_user_id: actorId(request),
        changed_at: now,
      };
      const result = await repository.vehicles.updateOne(
        { _id: id, physical_status: current.physical_status },
        {
          $set: { physical_status: input.status, updated_at: now },
          $push: { operational_status_history: history },
        },
      );
      if (!result.modifiedCount) throw httpError(409, 'Trạng thái xe vừa được cập nhật. Vui lòng tải lại.');
      await audit(request, 'vehicle.operational_status.update', 'vehicles', id, { from: current.physical_status || null, to: input.status });
      return { data: { id: id.toString(), physicalStatus: input.status, updatedAt: now } };
    },

    async scheduleVehicleInspection(request, idValue, body) {
      const id = new ObjectId(objectId(idValue));
      const input = parseVehicleInspectionAssignment(body);
      const vehicle = await repository.vehicles.findOne({ _id: id });
      if (!vehicle || !['submitted', 'pending_review'].includes(vehicle.onboarding_status)) {
        throw httpError(409, 'Hồ sơ xe không còn chờ kiểm định đầu vào.');
      }
      if (!['with_owner', 'returned_to_owner'].includes(vehicle.physical_status)) {
        throw httpError(409, 'Chỉ lên lịch kiểm định đầu vào khi xe đang ở chủ xe.');
      }
      if (vehicle.condition_declaration && ['registration', 'inspection_certificate', 'insurance'].some((key) => !vehicle.documents?.[key]?.file_key)) {
        throw httpError(409, 'Cần đủ đăng ký xe, đăng kiểm và bảo hiểm trước khi lên lịch kiểm định.');
      }

      const staff = await repository.users.findOne({ _id: input.garageStaffId, account_status: 'active' });
      if (!staff) throw httpError(404, 'Không tìm thấy Garage Staff đang hoạt động.');
      const roleIds = [staff.primary_role_id, ...(staff.additional_role_ids || [])].filter(Boolean);
      const roles = await repository.roles.find({ _id: { $in: roleIds } }).exec();
      if (!roles.some((role) => role.code === 'GARAGE_STAFF' && role.permissions?.includes('vehicle.inspect'))) {
        throw httpError(400, 'Chỉ phân công cho Garage Staff có quyền vehicle.inspect.');
      }

      await repository.vehicleInspections.ensureIndexes();
      const existing = await repository.vehicleInspections.findOne({
        vehicle_id: id,
        inspection_type: 'onboarding',
        approval_status: { $in: ['draft', 'pending'] },
      });
      if (existing) throw httpError(409, 'Xe đã có biên bản kiểm định đang mở.');

      const now = new Date();
      let inspection;
      try {
        inspection = await repository.vehicleInspections.create({
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
        });
      } catch (error) {
        if (error.code === 11000) throw httpError(409, 'Xe đã có biên bản kiểm định đang mở.');
        throw error;
      }

      await audit(request, 'vehicle.inspection.schedule', 'vehicle_inspections', inspection._id, {
        vehicle_id: id.toString(),
        garage_staff_id: input.garageStaffId.toString(),
        scheduled_for: input.scheduledFor,
      });
      return {
        data: {
          id: inspection._id.toString(),
          vehicleId: id.toString(),
          status: inspection.approval_status,
          scheduledFor: inspection.scheduled_for,
        },
      };
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
      const vehicle = await repository.vehicles.findOne({ _id: vehicleId }, { projection: { _id: 1 } });
      if (!vehicle) throw httpError(404, 'Không tìm thấy xe liên quan.');
      const bookingId = input.bookingId ? new ObjectId(input.bookingId) : null;
      if (bookingId && !await repository.bookings.findOne({ _id: bookingId, vehicle_id: vehicleId }, { projection: { _id: 1 } })) {
        throw httpError(404, 'Không tìm thấy booking của xe liên quan.');
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
      });
      await audit(request, 'incident.record', 'incident_cases', incident._id, { case_number: caseNumber, vehicle_id: vehicleId.toString() });
      return { data: { id: incident._id.toString(), caseNumber, status: incident.status } };
    },

    async updateIncident(request, idValue, body) {
      const id = new ObjectId(objectId(idValue));
      const changes = parseIncidentUpdate(body);
      const current = await repository.incidents.findOne({ _id: id });
      if (!current) throw httpError(404, 'Không tìm thấy hồ sơ sự cố.');
      if (['pending_manager', 'pending_review', 'escalated', 'resolved', 'closed'].includes(current.status)) {
        throw httpError(403, 'Hồ sơ đã chuyển Manager hoặc kết thúc; Operator không thể cập nhật.');
      }
      if (changes.status && changes.status !== current.status
        && !CASE_STATUS_TRANSITIONS[current.status]?.includes(changes.status)) {
        throw httpError(409, `Không thể chuyển hồ sơ từ ${current.status} sang ${changes.status}.`);
      }

      const now = new Date();
      const set = { updated_at: now };
      const timeline = [];
      for (const [key, value] of Object.entries(changes)) {
        if (key === 'note') continue;
        set[key] = value;
      }
      if (changes.status !== undefined) {
        timeline.push({ action: 'incident.status.update', status: changes.status, note: changes.note || '', actor_user_id: actorId(request), at: now });
      } else if (changes.note) {
        timeline.push({ action: 'incident.note', note: changes.note, actor_user_id: actorId(request), at: now });
      }
      const result = await repository.incidents.updateOne(
        { _id: id, status: current.status },
        { $set: set, ...(timeline.length ? { $push: { operation_timeline: { $each: timeline } } } : {}) },
      );
      if (!result.modifiedCount) throw httpError(409, 'Hồ sơ vừa được cập nhật. Vui lòng tải lại.');
      await audit(request, 'incident.update', 'incident_cases', id, { status: changes.status || current.status });
      return { data: { id: id.toString(), status: changes.status || current.status } };
    },

    async submitIncident(request, idValue) {
      const id = new ObjectId(objectId(idValue));
      const current = await repository.incidents.findOne({ _id: id });
      if (!current) throw httpError(404, 'Không tìm thấy hồ sơ sự cố.');
      if (['pending_manager', 'pending_review', 'escalated', 'resolved', 'closed'].includes(current.status)) {
        throw httpError(409, 'Hồ sơ đã được gửi Manager hoặc đã kết thúc.');
      }
      const now = new Date();
      const result = await repository.incidents.updateOne(
        { _id: id, status: current.status },
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
      );
      if (!result.modifiedCount) throw httpError(409, 'Hồ sơ vừa được cập nhật. Vui lòng tải lại.');
      await audit(request, 'incident.submit_to_manager', 'incident_cases', id, { status: 'pending_manager' });
      return { data: { id: id.toString(), status: 'pending_manager', submittedAt: now } };
    },

    async attachEvidence(request, idValue, body) {
      const id = new ObjectId(objectId(idValue));
      const file = parseIncidentEvidence(body);
      if (vehicleDocumentContentType(file.bytes) !== file.contentType) {
        throw httpError(400, 'Định dạng tệp không khớp với nội dung.');
      }
      const incident = await repository.incidents.findOne({ _id: id });
      if (!incident) throw httpError(404, 'Không tìm thấy hồ sơ sự cố.');
      if (['pending_manager', 'pending_review', 'escalated', 'resolved', 'closed'].includes(incident.status)) {
        throw httpError(403, 'Hồ sơ đã được gửi Manager hoặc đã kết thúc; không thể thêm biên bản.');
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
        const result = await repository.incidents.updateOne(
          { _id: id, status: incident.status, 'evidence.3': { $exists: false } },
          { $push: { evidence }, $set: { updated_at: now } },
        );
        if (!result.modifiedCount) throw httpError(409, 'Hồ sơ vừa được gửi Manager hoặc đã đạt giới hạn biên bản.');
        await audit(request, 'incident.evidence.attach', 'incident_cases', id, { content_type: file.contentType });
        return { data: { index: incident.evidence?.length || 0, name: file.name, uploadedAt: now } };
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
