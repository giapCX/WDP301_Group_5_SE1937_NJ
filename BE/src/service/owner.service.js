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

export function createOwnerService(repository) {
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
      const [vehicles, settlements, agreements, withdrawals, incidents] = await Promise.all([
        repository.findVehicles(ownerId),
        repository.findSettlements(ownerId),
        repository.findAgreements(ownerId),
        repository.findWithdrawalRequests(ownerId),
        repository.findIncidents(ownerId),
      ]);
      const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle._id.toString(), vehicle]));
      const totals = settlements.reduce((result, item) => {
        result.gross += Number(item.gross_rental_revenue) || 0;
        result.commission += Number(item.platform_commission) || 0;
        result.net += Number(item.net_owner_payout) || 0;
        if (item.payout_status === 'payable') result.withdrawable += Number(item.net_owner_payout) || 0;
        return result;
      }, { gross: 0, commission: 0, net: 0, withdrawable: 0 });
      return {
        vehicles: vehicles.map((vehicle) => ({
          id: vehicle._id.toString(), brand: vehicle.brand, model: vehicle.model,
          year: vehicle.manufacture_year, licensePlate: vehicle.license_plate,
          approvalStatus: vehicle.onboarding_status, reviewNote: vehicle.review_note || '',
          operatingStatus: vehicle.physical_status, updatedAt: vehicle.updated_at || vehicle.created_at,
        })),
        totals,
        settlements: settlements.map((item) => ({
          id: item._id.toString(), periodStart: item.period_start, periodEnd: item.period_end,
          gross: Number(item.gross_rental_revenue) || 0,
          commission: Number(item.platform_commission) || 0,
          net: Number(item.net_owner_payout) || 0, payoutStatus: item.payout_status,
          settledAt: item.settled_at,
        })),
        agreements: agreements.map((item) => ({
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
        incidents: incidents.map((item) => ({ id: item._id.toString(), caseNumber: item.case_number, vehicleId: item.vehicle_id?.toString(), bookingId: item.booking_id?.toString(), caseType: item.case_type, description: item.description, status: item.status, createdAt: item.created_at, compensation: (item.compensation_claims || []).reduce((sum, claim) => sum + (Number(claim.approved_amount) || 0), 0) })),
      };
    },

    async agreementDetails(agreementId, actor) {
      const ownerId = await actorId(actor);
      if (!/^[a-f\d]{24}$/i.test(agreementId || '')) throw httpError(400, 'Mã hợp đồng không hợp lệ.');
      const item = await repository.findAgreement(ownerId, new ObjectId(agreementId));
      if (!item) throw httpError(404, 'Không tìm thấy hợp đồng thuộc tài khoản của bạn.');
      return {
        id: item._id.toString(), number: item.agreement_number, status: item.status,
        commissionRatePct: item.commission_rate_pct, startDate: item.start_date, endDate: item.end_date,
        scope: item.authorization_scope, signature: item.signature_info,
        canOwnerSign: item.status === 'pending_signatures' && !item.signature_info?.owner_signed_at,
        terms: [
          'Chủ xe ủy quyền XeDi quản lý thông tin niêm yết và điều phối đặt xe.',
          `Phí nền tảng là ${item.commission_rate_pct}% trên phí thuê, không tính tiền đặt cọc.`,
          'Chủ xe cung cấp giấy tờ hợp lệ và phối hợp bàn giao, bảo dưỡng phương tiện.',
          'Việc chấm dứt hợp đồng cần gửi yêu cầu rút xe và hoàn tất các chuyến đang thực hiện.',
          'Các khoản đối soát được thanh toán theo kỳ sau khi khấu trừ phí và điều chỉnh hợp lệ.',
        ],
      };
    },

    async signAgreement(agreementId, body, actor) {
      const ownerId = await actorId(actor);
      if (!/^[a-f\d]{24}$/i.test(agreementId || '')) throw httpError(400, 'Mã hợp đồng không hợp lệ.');
      if (body?.acceptedTerms !== true) throw httpError(400, 'Bạn cần xác nhận đã đọc và đồng ý nội dung hợp đồng.');
      const signatureName = text(body.signatureName, 'Tên người ký', { max: 120 });
      const agreement = await repository.findAgreement(ownerId, new ObjectId(agreementId));
      if (!agreement) throw httpError(404, 'Không tìm thấy hợp đồng thuộc tài khoản của bạn.');
      if (agreement.status !== 'pending_signatures' || agreement.signature_info?.owner_signed_at) throw httpError(409, 'Hợp đồng này không còn chờ chữ ký chủ xe.');
      const now = new Date();
      const signatureInfo = {
        ...(agreement.signature_info || {}), method: 'electronic_acceptance',
        owner_signed_at: now, owner_signature_name: signatureName,
        terms_version: 'xedi-management-v1',
      };
      const active = Boolean(signatureInfo.platform_signed_at);
      const result = await repository.signPendingAgreement(ownerId, agreement._id, signatureInfo, active);
      if (result.modifiedCount !== 1) throw httpError(409, 'Hợp đồng vừa được cập nhật. Tải lại danh sách rồi thử lại.');
      await repository.createAudit({ actor_user_id: ownerId, action: 'agreement.sign', entity_type: 'management_agreement', entity_id: agreement._id, sanitized_changes: { agreement_number: agreement.agreement_number, terms_version: signatureInfo.terms_version }, created_at: now }).catch(() => {});
      return { id: agreement._id.toString(), number: agreement.agreement_number, status: active ? 'active' : 'pending_signatures', signedAt: now };
    },

    async requestPayout(body, actor) {
      const ownerId = await actorId(actor);
      const bankName = text(body?.bankName, 'Ngân hàng', { max: 80 });
      const accountName = text(body?.accountName, 'Tên chủ tài khoản', { max: 120 });
      const accountNumber = text(body?.accountNumber, 'Số tài khoản', { min: 6, max: 34 }).replace(/[\s-]/g, '');
      if (!/^[\p{L}0-9]+$/u.test(accountNumber)) throw httpError(400, 'Số tài khoản không hợp lệ.');
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
        await repository.createPaymentTransaction({ _id: transactionId, initiator_user_id: ownerId, transaction_type: 'owner_payout', direction: 'outbound', amount, currency: 'VND', payment_method: 'bank_transfer', provider: 'manual', provider_response: { bank_name: bankName, account_name: accountName, account_number: accountNumber }, idempotency_key: idempotencyKey, status: 'pending', created_at: now });
      } catch (error) {
        if (reserved.length) await repository.releaseSettlements(reserved, transactionId);
        throw error;
      }
      await repository.createAudit({ actor_user_id: ownerId, action: 'withdrawal.request', entity_type: 'payment_transaction', entity_id: transactionId, sanitized_changes: { amount, settlement_count: reserved.length }, created_at: new Date() }).catch(() => {});
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
          uploads.push(new ObjectId(key));
          evidence.push({ kind: file.contentType.startsWith('image/') ? 'photo' : 'document', file_key: key, uploaded_by_user_id: ownerId });
        }
        const trafficViolationDetails = caseType === 'traffic_violation' ? {
          reported_at: now,
          notice_number: body.noticeNumber ? text(body.noticeNumber, 'Mã biên bản', { max: 80 }) : undefined,
          fine_amount_claimed: body.fineAmountClaimed ? integer(body.fineAmountClaimed, 'Mức phạt giao thông', 1, 1000000000) : undefined,
        } : undefined;
        const incident = await repository.createIncident({ case_number: caseNumber, reported_by_user_id: ownerId, vehicle_id: vehicleId, booking_id: bookingId, case_type: caseType, description, evidence, traffic_violation_details: trafficViolationDetails, compensation_claims: body.compensationAmount ? [{ requested_amount: integer(body.compensationAmount, 'Số tiền yêu cầu bồi thường', 1, 1000000000), decision: 'pending' }] : [], status: 'reported', created_at: now, updated_at: now });
        await repository.createAudit({ actor_user_id: ownerId, action: 'incident.create', entity_type: 'incident_case', entity_id: incident._id, sanitized_changes: { case_number: caseNumber, vehicle_id: vehicleId, case_type: caseType }, created_at: now }).catch(() => {});
        return { id: incident._id.toString(), caseNumber, status: incident.status };
      } catch (error) {
        if (uploads.length) await repository.deletePrivateFiles(uploads);
        throw error;
      }
    },

    async registerVehicle(body, actor) {
      const ownerId = await actorId(actor);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Thông tin đăng ký xe không hợp lệ.');
      if (body.acceptedTerms !== true) throw httpError(400, 'Bạn cần xác nhận đồng ý điều khoản quản lý xe trước khi ký.');
      const licensePlate = text(body.licensePlate, 'Biển số xe', { max: 16 }).toUpperCase();
      const brand = text(body.brand, 'Hãng xe', { max: 60 });
      const model = text(body.model, 'Dòng xe', { max: 60 });
      const vehicleType = text(body.vehicleType, 'Kiểu xe', { max: 40 });
      const transmission = text(body.transmission, 'Hộp số', { max: 30 });
      const fuelType = text(body.fuelType, 'Nhiên liệu', { max: 30 });
      const description = text(body.description, 'Mô tả xe', { min: 10, max: 2000 });
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

      const fileIds = [];
      let vehicleId;
      let agreementId;
      try {
        const store = async (input, purpose) => {
          const id = await repository.uploadPrivateFile(ownerId, input, purpose);
          fileIds.push(new ObjectId(id));
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
          description, daily_price: dailyPrice,
          mileage_policy: { included_km_per_day: mileageLimit, extra_km_fee: extraMileageFee },
          photos: photoKeys, physical_status: 'with_owner', onboarding_status: 'submitted',
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
          agreement_number: agreementNumber, start_date: now, end_date: null,
          commission_rate_pct: 10,
          authorization_scope: {
            rental_contract_signing: true, vehicle_custody: true,
            listing_management: true, booking_management: true,
            owner_confirmation_per_booking: false,
            commission_basis: 'rental_fee_excluding_security_deposit',
          },
          signature_info: {
            method: 'electronic_acceptance', owner_signed_at: now,
            platform_signed_at: now,
            owner_signature_name: actor.user?.full_name || '',
            terms_version: 'xedi-management-v1',
          },
          status: 'active', termination_info: null, created_at: now, updated_at: now,
        };
        await repository.createAgreement(agreement);
        await repository.createAudit({
          actor_user_id: ownerId, action: 'agreement.sign', entity_type: 'management_agreement',
          entity_id: agreementId,
          sanitized_changes: { vehicle_id: vehicleId, agreement_number: agreementNumber, commission_rate_pct: 10, terms_version: 'xedi-management-v1' },
          created_at: now,
        });
        return { id: vehicleId.toString(), agreementId: agreementId.toString(), agreementNumber, signedAt: now, commissionRatePct: 10, status: 'submitted' };
      } catch (error) {
        const failure = error.code === 11000 && error.keyPattern?.license_plate
          ? httpError(409, 'Biển số xe đã được đăng ký trên hệ thống.')
          : error;
        const cleanup = [];
        if (agreementId) cleanup.push(repository.deleteAgreement(agreementId));
        if (vehicleId) cleanup.push(repository.deleteVehicle(vehicleId));
        await Promise.allSettled(cleanup);
        await repository.deletePrivateFiles(fileIds);
        throw failure;
      }
    },
  };
}
