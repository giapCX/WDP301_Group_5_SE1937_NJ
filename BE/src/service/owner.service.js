import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';

const { ObjectId } = Types;

const OWNER_CODES = new Set(['OWNER', 'CAR_OWNER']);
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function validateFile(input, label, allowed = ALLOWED_DOCUMENT_TYPES) {
  if (!input || typeof input !== 'object' || typeof input.name !== 'string' || typeof input.contentType !== 'string' || typeof input.data !== 'string')
    throw httpError(400, `Vui lòng tải lên ${label}.`);
  if (!allowed.includes(input.contentType)) throw httpError(400, `${label} phải là ${allowed.join(', ')}.`);
  const base64 = input.data.replace(/^data:[^,]+;base64,/, '');
  if (!base64 || !/^[A-Za-z\d+/]*={0,2}$/.test(base64)) throw httpError(400, `${label} không hợp lệ.`);
  const bytes = Buffer.from(base64, 'base64');
  const maxBytes = 4 * 1024 * 1024;
  if (!bytes.length || bytes.length > maxBytes) throw httpError(400, `${label} không được vượt quá 4 MB.`);
  return { name: input.name, contentType: input.contentType, bytes };
}

function integer(value, field, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw httpError(400, `${field} phải từ ${min} đến ${max}.`);
  return parsed;
}

function text(value, field, { min = 1, max = 120 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw httpError(400, `${field} không hợp lệ.`);
  return value.trim();
}

function ownerReview(body, ownerId) {
  const { version, status, note = '' } = body || {};
  if (!Number.isSafeInteger(version) || version < 0 || !['accepted', 'disputed'].includes(status)
    || typeof note !== 'string' || note.length > 1000 || (status === 'disputed' && !note.trim())) {
    throw httpError(400, 'Cần xác nhận hoặc ghi rõ nội dung bất đồng.');
  }
  return { version, review: { status, note: note.trim(), reviewed_at: new Date(), owner_id: ownerId, reviewed_version: version } };
}

export function createOwnerService(repository, contracts, handovers) {
  async function actorId(actor) {
    const id = actor?.tokenPayload?.sub;
    if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw httpError(401, 'Phiên đăng nhập không hợp lệ.');
    const ownerId = new ObjectId(id);
    const roleIds = [actor.user?.primary_role_id, ...(actor.user?.additional_role_ids || [])].filter(Boolean);
    const roles = roleIds.length ? await repository.findRoles(roleIds) : [];
    if (!roles.some(({ code }) => OWNER_CODES.has(code))) throw httpError(403, 'Bạn không có quyền truy cập khu vực chủ xe.');
    return ownerId;
  }

  return {
    async dashboard(actor) {
      const ownerId = await actorId(actor);
      const [vehicles, settlements, agreements, withdrawals] = await Promise.all([
        repository.findVehicles(ownerId),
        repository.findSettlements(ownerId),
        repository.findAgreements(ownerId),
        repository.findWithdrawalRequests(ownerId),
      ]);
      const vehicleIds = vehicles.map((vehicle) => vehicle._id);
      const [incidents, inspections, intakes, listings] = await Promise.all([
        repository.findIncidents(vehicleIds), repository.findInspections(vehicleIds), repository.findLatestIntakes(vehicleIds), repository.findListings(vehicleIds),
      ]);
      const latestByVehicle = (records) => new Map([...records].reverse().map((item) => [String(item.vehicle_id), item]));
      const inspectionMap = latestByVehicle(inspections);
      const intakeMap = latestByVehicle(intakes);
      const listingMap = latestByVehicle(listings);
      const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle._id.toString(), vehicle]));
      const totals = settlements.reduce((result, item) => {
        result.gross += Number(item.gross_rental_revenue) || 0;
        result.commission += Number(item.platform_commission) || 0;
        result.net += Number(item.net_owner_payout) || 0;
        if (item.payout_status === 'payable') result.withdrawable += Number(item.net_owner_payout) || 0;
        return result;
      }, { gross: 0, commission: 0, net: 0, withdrawable: 0 });
      return {
        vehicles: vehicles.map((vehicle) => {
          const inspection = inspectionMap.get(String(vehicle._id));
          const intake = intakeMap.get(String(vehicle._id));
          const withdrawal = withdrawals.find((item) => String(item.vehicle_id) === String(vehicle._id) && item.owner_return_handover?.version);
          return {
          id: vehicle._id.toString(), brand: vehicle.brand, model: vehicle.model,
          year: vehicle.manufacture_year, licensePlate: vehicle.license_plate,
          approvalStatus: vehicle.onboarding_status, reviewNote: vehicle.review_note || '',
          documentReview: vehicle.operator_document_review || null,
          operatingStatus: vehicle.physical_status, updatedAt: vehicle.updated_at || vehicle.created_at,
          conditionDeclaration: vehicle.condition_declaration || '',
          inspectionScheduleRequest: vehicle.inspection_schedule_request ? {
            status: vehicle.inspection_schedule_request.status,
            requestedFor: vehicle.inspection_schedule_request.requested_for || null,
            scheduledFor: vehicle.inspection_schedule_request.scheduled_for || null,
            note: vehicle.inspection_schedule_request.note || '',
            responseNote: vehicle.inspection_schedule_request.response_note || '',
          } : null,
          listing: listingMap.get(String(vehicle._id)) || null,
          inspection: inspection ? {
            id: inspection._id, version: inspection.version, status: inspection.approval_status,
            scheduledFor: inspection.scheduled_for, scheduleNote: inspection.schedule_note,
            arrivalReview: inspection.arrival_review,
            operatorReview: inspection.operator_review,
            ...(inspection.approval_status !== 'draft' && { recommendation: inspection.recommendation, conditionReport: inspection.condition_report }),
            ownerReview: inspection.owner_review, decisionReason: inspection.decision_reason,
          } : null,
          intake: intake ? {
            id: intake._id, status: intake.status, version: intake.version, ownerReview: intake.owner_review, confirmedAt: intake.owner_confirmed_at, agreementId: intake.management_agreement_id,
            odometer: intake.odometer_km, fuel: intake.fuel_level_pct, condition: intake.condition_snapshot,
          } : null,
          ownerReturn: withdrawal ? { id: withdrawal._id, status: withdrawal.status, ...withdrawal.owner_return_handover } : null,
          documents: {
            registration: { verified: Boolean(vehicle.documents?.registration?.verified), reviewStatus: vehicle.documents?.registration?.review_status || null, reviewNote: vehicle.documents?.registration?.review_note || '' },
            inspectionCertificate: { verified: Boolean(vehicle.documents?.inspection_certificate?.verified), reviewStatus: vehicle.documents?.inspection_certificate?.review_status || null, reviewNote: vehicle.documents?.inspection_certificate?.review_note || '' },
            insurance: { verified: Boolean(vehicle.documents?.insurance?.verified), reviewStatus: vehicle.documents?.insurance?.review_status || null, reviewNote: vehicle.documents?.insurance?.review_note || '' },
          },
          };
        }),
        totals,
        payoutAccount: actor.user?.payout_profile?.bank_name && actor.user?.payout_profile?.account_masked
          ? { bankName: actor.user.payout_profile.bank_name, accountMasked: actor.user.payout_profile.account_masked }
          : null,
        settlements: settlements.map((item) => ({
          id: item._id.toString(), periodStart: item.period_start, periodEnd: item.period_end,
          gross: Number(item.gross_rental_revenue) || 0,
          commission: Number(item.platform_commission) || 0,
          net: Number(item.net_owner_payout) || 0, payoutStatus: item.payout_status,
          settledAt: item.settled_at,
        })),
        agreements: agreements.filter((item) => !item.arrival_confirmed_at || !['draft', 'pending_manager_review'].includes(item.status)).map((item) => ({
          id: item._id.toString(), number: item.agreement_number,
          vehicle: vehiclesById.get(item.vehicle_id?.toString())
            ? `${vehiclesById.get(item.vehicle_id.toString()).brand} ${vehiclesById.get(item.vehicle_id.toString()).model}`
            : 'Phương tiện',
          vehicleId: item.vehicle_id?.toString(), commissionRatePct: item.commission_rate_pct,
          signedAt: item.signature_info?.owner_signed_at || null,
          signatureName: item.signature_info?.owner_signature_name || '',
          termsVersion: item.signature_info?.terms_version || '', status: item.status,
        })),
        withdrawals: withdrawals.map((item) => ({ id: item._id.toString(), vehicleId: item.vehicle_id?.toString(), reason: item.reason, requestedReturnAt: item.requested_return_at, status: item.status, requestedAt: item.requested_at || item.created_at })),
        incidents: incidents.map((item) => ({ id: item._id.toString(), caseNumber: item.case_number, vehicleId: item.vehicle_id?.toString(), bookingId: item.booking_id?.toString(), caseType: item.case_type, vehicleSeized: typeof item.vehicle_seized === 'boolean' ? item.vehicle_seized : null, description: item.description, status: item.status, createdAt: item.created_at, compensation: (item.compensation_claims || []).reduce((sum, claim) => sum + (Number(claim.approved_amount) || 0), 0) })),
      };
    },

    async respondToInspection(vehicleValue, inspectionValue, body, actor) {
      const ownerId = await actorId(actor);
      if (![vehicleValue, inspectionValue].every((value) => /^[a-f0-9]{24}$/i.test(value))) throw httpError(404, 'Không tìm thấy hồ sơ.');
      const vehicleId = new ObjectId(vehicleValue);
      const vehicle = await repository.findVehicle(ownerId, vehicleId);
      if (!vehicle) throw httpError(404, 'Không tìm thấy hồ sơ xe.');
      const { version, review } = ownerReview(body, ownerId);
      const result = await repository.respondToInspection(vehicleId, new ObjectId(inspectionValue), version, review);
      if (result.modifiedCount !== 1) throw httpError(409, 'Biên bản đã đổi phiên bản hoặc đã được phản hồi. Vui lòng tải lại.');
    },

    async requestInspectionSchedule(vehicleValue, body, actor) {
      const ownerId = await actorId(actor);
      if (!/^[a-f\d]{24}$/i.test(vehicleValue || '')) throw httpError(400, 'Phương tiện không hợp lệ.');
      if (actor.user?.identity_kyc?.status !== 'verified') throw httpError(409, 'Cần được xác minh danh tính trước khi yêu cầu kiểm định xe.');
      if (typeof body?.requestedFor !== 'string' || Number.isNaN(Date.parse(body.requestedFor))
        || new Date(body.requestedFor) <= new Date()) throw httpError(400, 'Thời gian đề xuất phải hợp lệ và ở tương lai.');
      const note = text(body.note, 'Ghi chú lịch kiểm định', { min: 5, max: 500 });
      const vehicleId = new ObjectId(vehicleValue);
      const vehicle = await repository.findVehicle(ownerId, vehicleId);
      if (!vehicle) throw httpError(404, 'Không tìm thấy xe thuộc tài khoản của bạn.');
      if (vehicle.operator_document_review?.status !== 'verified' && (vehicle.operator_document_review || vehicle.condition_declaration)) {
        throw httpError(409, 'Operator cần xác thực hồ sơ xe trước khi bạn đặt lịch.');
      }
      if (!['submitted', 'pending_review', 'revision_required'].includes(vehicle.onboarding_status)
        || !['with_owner', 'returned_to_owner'].includes(vehicle.physical_status)) {
        throw httpError(409, 'Xe hiện không ở trạng thái có thể yêu cầu kiểm định đầu vào.');
      }
      if (await repository.findOpenInspection(vehicleId)) throw httpError(409, 'Xe đã có lịch hoặc biên bản kiểm định đang xử lý.');
      if (vehicle.inspection_schedule_request?.status === 'pending') throw httpError(409, 'Yêu cầu lịch kiểm định đang chờ Operator xác nhận.');
      const now = new Date();
      const request = {
        status: 'pending',
        requested_for: new Date(body.requestedFor),
        note,
        requested_at: now,
      };
      const changed = await repository.updateVehicle(vehicleId, ownerId, {
        $set: { inspection_schedule_request: request, updated_at: now },
      }, { updated_at: vehicle.updated_at });
      if (changed.modifiedCount !== 1) throw httpError(409, 'Hồ sơ xe vừa được cập nhật. Vui lòng tải lại.');
      await repository.createAudit({
        actor_user_id: ownerId, action: 'vehicle.inspection_schedule.request', entity_type: 'vehicles',
        entity_id: vehicleId, sanitized_changes: { requested_for: request.requested_for }, created_at: now,
      });
      return { status: request.status, requestedFor: request.requested_for };
    },

    async respondToIntake(vehicleValue, intakeValue, body, actor) {
      const ownerId = await actorId(actor);
      if (![vehicleValue, intakeValue].every((value) => /^[a-f0-9]{24}$/i.test(value))) throw httpError(404, 'Không tìm thấy biên bản.');
      const vehicleId = new ObjectId(vehicleValue);
      const intakeId = new ObjectId(intakeValue);
      if (!await repository.findVehicle(ownerId, vehicleId)) throw httpError(404, 'Không tìm thấy hồ sơ xe.');
      const { version, review } = ownerReview(body, ownerId);
      const intake = await repository.findIntake(vehicleId, intakeId);
      if (!intake || !Number.isInteger(intake.odometer_km) || !Number.isInteger(intake.fuel_level_pct)
        || !['exterior', 'interior', 'engine', 'tires'].every((key) => intake.condition_snapshot?.[key])) {
        throw httpError(409, 'Garage chưa lưu đủ thông tin biên bản tiếp nhận.');
      }
      const result = await repository.respondToIntake(vehicleId, intakeId, version, review);
      if (result.modifiedCount !== 1) throw httpError(409, 'Biên bản đã đổi phiên bản hoặc đã được phản hồi. Vui lòng tải lại.');
    },

    async confirmOwnerReturn(value, body, actor) {
      const ownerId = await actorId(actor);
      if (!/^[a-f0-9]{24}$/i.test(value) || body?.received !== true)
        throw httpError(400, 'Cần xác nhận đã nhận xe thực tế.');
      const confirmation = ownerReview(body, ownerId);
      const result = await handovers.confirmOwnerReturn(new ObjectId(value), confirmation);
      return { id: result._id, status: result.status };
    },

    async agreementDetails(agreementId, actor) {
      await actorId(actor);
      return contracts.detail('management', agreementId, actor);
    },
    async signAgreement(agreementId, body, actor) {
      await actorId(actor);
      return contracts.sign('management', agreementId, body, actor);
    },

    async requestPayout(_body, actor) {
      const ownerId = await actorId(actor);
      const payoutProfile = actor.user?.payout_profile;
      if (!payoutProfile?.bank_name || !payoutProfile?.account_token || !payoutProfile?.account_masked)
        throw httpError(400, 'Bạn cần liên kết tài khoản ngân hàng trước khi yêu cầu chi trả.');
      const available = await repository.findPayableSettlements(ownerId);
      let amount = 0;
      const selected = [];
      for (const item of available) {
        const net = Math.floor(Number(item.net_owner_payout) || 0);
        if (net <= 0) continue;
        selected.push(item); amount += net;
      }
      if (amount < 100000) throw httpError(400, 'Số dư có thể chi trả tối thiểu là 100.000 ₫.');
      const transactionId = new ObjectId();
      const reserved = [];
      try {
        for (const item of selected) {
          const result = await repository.reserveSettlement(ownerId, item._id, transactionId);
          if (result.modifiedCount !== 1) throw httpError(409, 'Số dư vừa thay đổi. Hãy tải lại báo cáo và thử lại.');
          reserved.push(item._id);
        }
        const now = new Date();
        const idempotencyKey = `owner-payout:${ownerId}:${transactionId}`;
        await repository.createPaymentTransaction({ _id: transactionId, initiator_user_id: ownerId, transaction_type: 'owner_payout', direction: 'outbound', amount, currency: 'VND', payment_method: 'bank_transfer', provider: 'manual', provider_response: { bank_name: payoutProfile.bank_name, account_token: payoutProfile.account_token, account_masked: payoutProfile.account_masked }, idempotency_key: idempotencyKey, status: 'pending', created_at: now });
      } catch (error) {
        if (reserved.length) await repository.releaseSettlements(reserved, transactionId);
        throw error;
      }
      await repository.createAudit({ actor_user_id: ownerId, action: 'payout.request', entity_type: 'payment_transaction', entity_id: transactionId, sanitized_changes: { amount, settlement_count: reserved.length }, created_at: new Date() }).catch(() => {});
      return { transactionId: transactionId.toString(), amount, status: 'pending' };
    },

    async requestVehicleWithdrawal(body, actor) {
      const ownerId = await actorId(actor);
      if (!/^[a-f\d]{24}$/i.test(body?.vehicleId || '')) throw httpError(400, 'Phương tiện không hợp lệ.');
      const vehicleId = new ObjectId(body.vehicleId);
      const [vehicle, activeBookings, existing] = await Promise.all([
        repository.findVehicle(ownerId, vehicleId), repository.findActiveBookings(vehicleId), repository.findOpenWithdrawal(vehicleId),
      ]);
      if (!vehicle) throw httpError(404, 'Không tìm thấy xe thuộc tài khoản của bạn.');
      if (!['approved', 'revision_required'].includes(vehicle.onboarding_status)) throw httpError(400, 'Chỉ xe đã được tiếp nhận mới có thể yêu cầu rút khỏi nền tảng.');
      if (['rented', 'maintenance'].includes(vehicle.physical_status)) throw httpError(409, 'Xe đang vận hành hoặc bảo dưỡng, chưa thể yêu cầu rút.');
      if (activeBookings.length) throw httpError(409, 'Xe còn chuyến đã xác nhận hoặc đang diễn ra; vui lòng hoàn tất trước khi rút xe.');
      if (existing) throw httpError(409, 'Xe đã có yêu cầu rút đang được xử lý.');
      const requestedReturnAt = body.requestedReturnAt ? new Date(body.requestedReturnAt) : undefined;
      if (requestedReturnAt && (!Number.isFinite(requestedReturnAt.getTime()) || requestedReturnAt < new Date(new Date().setHours(0, 0, 0, 0)))) throw httpError(400, 'Ngày nhận lại xe không hợp lệ.');
      const agreement = (await repository.findAgreements(ownerId)).find((item) => item.vehicle_id?.toString() === vehicleId.toString() && item.status === 'active');
      const now = new Date();
      const reason = text(body.reason, 'Lý do rút xe', { min: 5, max: 1000 });
      const request = await repository.createWithdrawalRequest({ vehicle_id: vehicleId, owner_id: ownerId, management_agreement_id: agreement?._id, request_type: 'owner_withdrawal', reason, requested_return_at: requestedReturnAt, requested_at: now, affected_bookings: [], termination_notice: { notice_method: 'owner_portal', status: 'pending' }, final_settlement: { status: 'pending' }, status: 'requested', created_at: now });
      if (agreement) await repository.requestAgreementTermination(ownerId, agreement._id, now, reason);
      await repository.createAudit({ actor_user_id: ownerId, action: 'vehicle.withdrawal.request', entity_type: 'vehicle_withdrawal_request', entity_id: request._id, sanitized_changes: { vehicle_id: vehicleId }, created_at: now }).catch(() => {});
      return { id: request._id.toString(), status: request.status };
    },

    async reportIncident(body, actor) {
      const ownerId = await actorId(actor);
      if (!/^[a-f\d]{24}$/i.test(body?.vehicleId || '')) throw httpError(400, 'Phương tiện không hợp lệ.');
      const vehicleId = new ObjectId(body.vehicleId);
      const vehicle = await repository.findVehicle(ownerId, vehicleId);
      if (!vehicle) throw httpError(404, 'Không tìm thấy xe thuộc tài khoản của bạn.');
      let bookingId;
      if (body.bookingId) {
        if (!/^[a-f\d]{24}$/i.test(body.bookingId)) throw httpError(400, 'Mã chuyến thuê không hợp lệ.');
        bookingId = new ObjectId(body.bookingId);
        if (!(await repository.findBooking(vehicleId, bookingId))) throw httpError(404, 'Không tìm thấy chuyến thuê của phương tiện này.');
      }
      const caseType = ['vehicle_damage', 'traffic_violation', 'theft', 'other'].includes(body.caseType) ? body.caseType : null;
      if (!caseType) throw httpError(400, 'Loại sự cố không hợp lệ.');
      const description = text(body.description, 'Nội dung sự cố', { min: 10, max: 3000 });
      if (typeof body.vehicleSeized !== 'boolean') throw httpError(400, 'Cần xác nhận xe có bị cơ quan chức năng tạm giữ hay không.');
      const now = new Date();
      const caseNumber = `INC-${now.getFullYear()}-${new ObjectId().toString().slice(-8).toUpperCase()}`;
      const uploads = [];
      if (body.evidence !== undefined && !Array.isArray(body.evidence)) throw httpError(400, 'Danh sách minh chứng không hợp lệ.');
      if ((body.evidence || []).length > 3) throw httpError(400, 'Chỉ được đính kèm tối đa 3 minh chứng.');
      try {
        const evidence = [];
        for (const input of body.evidence || []) {
          const file = validateFile(input, 'Minh chứng sự cố');
          const key = await repository.uploadPrivateFile(ownerId, file, 'incident_evidence');
          uploads.push(key);
          evidence.push({ kind: file.contentType.startsWith('image/') ? 'photo' : 'document', file_key: key, uploaded_by_user_id: ownerId });
        }
        const trafficViolationDetails = caseType === 'traffic_violation' ? {
          reported_at: now,
          notice_number: body.noticeNumber ? text(body.noticeNumber, 'Mã biên bản', { max: 80 }) : undefined,
          fine_amount_claimed: body.fineAmountClaimed ? integer(body.fineAmountClaimed, 'Mức phạt giao thông', 1, 1000000000) : undefined,
        } : undefined;
        const incident = await repository.createIncident({ case_number: caseNumber, reported_by_user_id: ownerId, report_source: 'owner', vehicle_id: vehicleId, booking_id: bookingId, case_type: caseType, vehicle_seized: body.vehicleSeized, description, evidence, traffic_violation_details: trafficViolationDetails, compensation_claims: body.compensationAmount ? [{ requested_amount: integer(body.compensationAmount, 'Số tiền yêu cầu bồi thường', 1, 1000000000), decision: 'pending' }] : [], status: 'reported', created_at: now, updated_at: now });
        await repository.createAudit({ actor_user_id: ownerId, action: 'incident.create', entity_type: 'incident_case', entity_id: incident._id, sanitized_changes: { case_number: caseNumber, vehicle_id: vehicleId, case_type: caseType }, created_at: now }).catch(() => {});
        return { id: incident._id.toString(), caseNumber, status: incident.status };
      } catch (error) {
        if (uploads.length) await repository.deletePrivateFiles(uploads);
        throw error;
      }
    },

    async registerVehicle(body, actor) {
      const ownerId = await actorId(actor);
      if (actor.user?.identity_kyc?.status !== 'verified') throw httpError(409, 'Cần được xác minh danh tính trước khi đăng ký xe.');
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Thông tin đăng ký xe không hợp lệ.');
      if (body.acceptedTerms !== true) throw httpError(400, 'Bạn cần xác nhận thông tin hồ sơ và đồng ý quy trình đăng ký xe.');
      const licensePlate = text(body.licensePlate, 'Biển số xe', { max: 16 }).toUpperCase();
      const brand = text(body.brand, 'Hãng xe', { max: 60 });
      const model = text(body.model, 'Dòng xe', { max: 60 });
      const vehicleType = text(body.vehicleType, 'Kiểu xe', { max: 40 });
      const transmission = text(body.transmission, 'Hộp số', { max: 30 });
      const fuelType = text(body.fuelType, 'Nhiên liệu', { max: 30 });
      const description = text(body.description, 'Mô tả xe', { min: 10, max: 2000 });
      const ownerContactAddress = body.ownerContactAddress ? text(body.ownerContactAddress, 'Địa chỉ chủ xe', { max: 250 }) : undefined;
      const vin = body.vin ? text(body.vin, 'Số khung', { max: 40 }).toUpperCase() : undefined;
      if (vin && !/^[A-Z0-9-]+$/.test(vin)) throw httpError(400, 'Số khung không hợp lệ.');
      const conditionDeclaration = text(body.conditionDeclaration, 'Khai báo hiện trạng', { max: 1500 });
      const year = integer(body.year, 'Năm sản xuất', 1990, new Date().getFullYear() + 1);
      const seats = integer(body.seats, 'Số chỗ', 2, 50);
      const dailyPrice = integer(body.dailyPrice, 'Giá thuê mỗi ngày', 100000, 100000000);
      const mileageLimit = integer(body.mileageLimit, 'Giới hạn km', 50, 2000);
      const extraMileageFee = integer(body.extraMileageFee, 'Phí vượt km', 0, 1000000);
      const docs = body.documents || {};
      const registration = validateFile(docs.registration, 'Giấy đăng ký xe');
      const inspection = validateFile(docs.inspectionCertificate, 'Giấy chứng nhận đăng kiểm');
      const insurance = validateFile(docs.insurance, 'Giấy chứng nhận bảo hiểm');
      if (!Array.isArray(body.photos) || body.photos.length < 2 || body.photos.length > 5)
        throw httpError(400, 'Tải lên từ 2 đến 5 ảnh ngoại thất hoặc nội thất xe.');
      const photos = body.photos.map((photo, index) => validateFile(photo, `Ảnh xe số ${index + 1}`, ['image/jpeg', 'image/png', 'image/webp']));

      const fileKeys = [];
      let vehicleId;
      let agreementId;
      try {
        const store = async (input, purpose) => {
          const id = await repository.uploadPrivateFile(ownerId, input, purpose);
          fileKeys.push(id);
          return id;
        };
        const registrationKey = await store(registration, 'vehicle_registration');
        const inspectionKey = await store(inspection, 'inspection_certificate');
        const insuranceKey = await store(insurance, 'insurance');
        const photoKeys = [];
        for (const photo of photos) photoKeys.push(await store(photo, 'vehicle_photo'));

        const now = new Date();
        vehicleId = new ObjectId();
        const agreementNumberId = new ObjectId();
        agreementId = agreementNumberId;
        const agreementNumber = `MGMT-${now.getFullYear()}-${agreementNumberId.toString().slice(-8).toUpperCase()}`;
        const vehicle = {
          _id: vehicleId, owner_id: ownerId, brand, model, license_plate: licensePlate,
          manufacture_year: year, seats, vehicle_type: vehicleType, transmission, fuel_type: fuelType,
          description, vin, owner_contact_address: ownerContactAddress, condition_declaration: conditionDeclaration, daily_price: dailyPrice,
          mileage_policy: { included_km_per_day: mileageLimit, extra_km_fee: extraMileageFee },
          photos: photoKeys, publish_vehicle_photos: body.publishVehiclePhotos === true, physical_status: 'with_owner', onboarding_status: 'submitted',
          operator_document_review: { status: 'pending' },
          documents: {
            registration: { file_key: registrationKey, verified: false },
            inspection_certificate: { file_key: inspectionKey, verified: false },
            insurance: { file_key: insuranceKey, verified: false },
          },
          registration_history: [{ action: 'submitted', by_user_id: ownerId, at: now }],
          created_at: now, updated_at: now,
        };
        await repository.createVehicle(vehicle);
        const agreement = {
          _id: agreementId, vehicle_id: vehicleId, owner_id: ownerId,
          agreement_number: agreementNumber,
          commission_rate_pct: 10,
          authorization_scope: {
            rental_contract_signing: true, vehicle_custody: true,
            listing_management: true, booking_management: true,
            owner_confirmation_per_booking: false,
            commission_basis: 'rental_fee_excluding_security_deposit',
          },
          signature_info: { terms_version: 'xedi-acceptance-v1' },
          status: 'draft', termination_info: null, created_at: now, updated_at: now,
        };
        await repository.createAgreement(agreement);
        await repository.createAudit({
          actor_user_id: ownerId, action: 'agreement.draft', entity_type: 'management_agreement',
          entity_id: agreementId,
          sanitized_changes: { vehicle_id: vehicleId, agreement_number: agreementNumber, commission_rate_pct: 10, terms_version: 'xedi-management-v1' },
          created_at: now,
        });
        return { id: vehicleId.toString(), agreementId: agreementId.toString(), agreementNumber, signedAt: null, commissionRatePct: 10, status: 'submitted' };
      } catch (error) {
        const failure = error.code === 11000 && error.keyPattern?.license_plate
          ? httpError(409, 'Biển số xe đã được đăng ký trên hệ thống.')
          : error;
        const cleanup = [];
        if (agreementId) cleanup.push(repository.deleteAgreement(agreementId));
        if (vehicleId) cleanup.push(repository.deleteVehicle(vehicleId));
        await Promise.allSettled(cleanup);
        await repository.deletePrivateFiles(fileKeys);
        throw failure;
      }
    },

    async resubmitVehicleDocuments(vehicleIdStr, body, actor) {
      const ownerId = await actorId(actor);
      if (!/^[a-f\d]{24}$/i.test(vehicleIdStr || '')) throw httpError(400, 'Mã phương tiện không hợp lệ.');
      const vehicleId = new ObjectId(vehicleIdStr);
      const vehicle = await repository.findVehicle(ownerId, vehicleId);
      if (!vehicle) throw httpError(404, 'Không tìm thấy xe thuộc tài khoản của bạn.');
      if (vehicle.onboarding_status !== 'revision_required') {
        throw httpError(409, 'Xe này không ở trạng thái yêu cầu bổ sung hồ sơ.');
      }

      const docs = body?.documents || {};
      const hasPhotos = Array.isArray(body?.photos) && body.photos.length > 0;
      const hasDocs = Boolean(docs.registration || docs.inspectionCertificate || docs.insurance);
      const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : '';
      if (!hasDocs && !hasPhotos && (!vehicle.condition_declaration || note.length < 5)) {
        throw httpError(400, 'Cần tải tài liệu, ảnh xe hoặc mô tả nội dung đã khắc phục.');
      }

      const uploadedKeys = [];
      try {
        const store = async (input, purpose) => {
          const key = await repository.uploadPrivateFile(ownerId, input, purpose);
          uploadedKeys.push(key);
          return key;
        };

        const now = new Date();
        const updates = {
          onboarding_status: 'pending_review',
          operator_document_review: { status: 'pending' },
          updated_at: now,
        };

        if (docs.registration) {
          const file = validateFile(docs.registration, 'Giấy đăng ký xe');
          const key = await store(file, 'vehicle_registration');
          updates['documents.registration.file_key'] = key;
          updates['documents.registration.verified'] = false;
          updates['documents.registration.review_status'] = 'pending';
          updates['documents.registration.review_note'] = '';
          updates['documents.registration.reviewed_at'] = null;
        }

        if (docs.inspectionCertificate) {
          const file = validateFile(docs.inspectionCertificate, 'Giấy chứng nhận đăng kiểm');
          const key = await store(file, 'inspection_certificate');
          updates['documents.inspection_certificate.file_key'] = key;
          updates['documents.inspection_certificate.verified'] = false;
          updates['documents.inspection_certificate.review_status'] = 'pending';
          updates['documents.inspection_certificate.review_note'] = '';
          updates['documents.inspection_certificate.reviewed_at'] = null;
        }

        if (docs.insurance) {
          const file = validateFile(docs.insurance, 'Giấy chứng nhận bảo hiểm');
          const key = await store(file, 'insurance');
          updates['documents.insurance.file_key'] = key;
          updates['documents.insurance.verified'] = false;
          updates['documents.insurance.review_status'] = 'pending';
          updates['documents.insurance.review_note'] = '';
          updates['documents.insurance.reviewed_at'] = null;
        }

        if (hasPhotos) {
          if (body.photos.length < 2 || body.photos.length > 5) {
            throw httpError(400, 'Tải lên từ 2 đến 5 ảnh ngoại thất hoặc nội thất xe.');
          }
          const photoFiles = body.photos.map((p, idx) => validateFile(p, `Ảnh xe số ${idx + 1}`, ['image/jpeg', 'image/png', 'image/webp']));
          const photoKeys = [];
          for (const photo of photoFiles) {
            photoKeys.push(await store(photo, 'vehicle_photo'));
          }
          updates.photos = photoKeys;
        }

        const result = await repository.updateVehicle(vehicleId, ownerId, {
          $set: updates,
          $unset: { inspection_schedule_request: 1 },
          $push: {
            registration_history: {
              action: 'revision_submitted',
              by_user_id: ownerId,
              at: now,
              note: note || 'Chủ xe đã gửi hồ sơ bổ sung',
            },
          },
        }, { onboarding_status: 'revision_required', updated_at: vehicle.updated_at });

        if (result.modifiedCount !== 1) {
          throw httpError(409, 'Không thể cập nhật hồ sơ xe.');
        }

        await repository.createAudit({
          actor_user_id: ownerId,
          action: 'vehicle.revision.submit',
          entity_type: 'vehicles',
          entity_id: vehicleId,
          sanitized_changes: {
            resubmitted_documents: Object.keys(docs),
            has_new_photos: hasPhotos,
          },
          created_at: now,
        }).catch(() => {});

        return {
          id: vehicleId.toString(),
          onboardingStatus: 'pending_review',
          resubmittedAt: now,
        };
      } catch (error) {
        if (uploadedKeys.length) {
          await repository.deletePrivateFiles(uploadedKeys);
        }
        throw error;
      }
    },
  };
}
