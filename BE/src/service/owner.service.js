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
      const [vehicles, settlements, agreements] = await Promise.all([
        repository.findVehicles(ownerId),
        repository.findSettlements(ownerId),
        repository.findAgreements(ownerId),
      ]);
      const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle._id.toString(), vehicle]));
      const totals = settlements.reduce((result, item) => {
        result.gross += Number(item.gross_rental_revenue) || 0;
        result.commission += Number(item.platform_commission) || 0;
        result.net += Number(item.net_owner_payout) || 0;
        if (item.payout_status !== 'paid') result.withdrawable += Number(item.net_owner_payout) || 0;
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
      };
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
