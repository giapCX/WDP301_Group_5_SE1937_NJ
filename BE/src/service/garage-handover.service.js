import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';
import { garageTransaction } from '../utils/garage-transaction.js';

const fields = ['exterior', 'interior', 'engine', 'tires'];
const vehicleProjection = { brand: 1, model: 1, license_plate: 1, onboarding_status: 1, physical_status: 1 };
const same = (a, b) => a && b && String(a) === String(b);
const complete = (record) => record?.status === 'confirmed';
const rank = (condition) => condition === 'damaged' ? 2 : condition === 'attention' ? 1 : 0;

export function createGarageHandoverService(repository) {
  let indexes;
  async function ensureIndexes() {
    if (!indexes) indexes = Promise.all([repository.handovers.ensureIndexes(), repository.incidents.ensureIndexes()]).catch((error) => {
      indexes = undefined;
      throw httpError(503, 'Chưa tạo được index giao nhận/sự cố. Kiểm tra biên bản trùng trước khi tiếp tục.');
    });
    await indexes;
  }
  async function context(bookingId, type, session) {
    const options = session ? { session } : {};
    const booking = await repository.bookings.findOne({ _id: bookingId }, options);
    if (!booking) throw httpError(404, 'Không tìm thấy đơn thuê.');
    const vehicle = await repository.vehicles.findOne({ _id: booking.vehicle_id }, { ...options, projection: vehicleProjection });
    if (!vehicle) throw httpError(404, 'Không tìm thấy xe.');
    const renter = await repository.users.findOne({ _id: booking.renter_id }, { ...options, projection: { full_name: 1, account_status: 1, 'identity_kyc.status': 1, 'driver_license.verification_status': 1, 'driver_license.expires_at': 1 } });
    const agreement = await repository.agreements.findOne({ booking_id: bookingId }, options);
    const management = await repository.managementAgreements.findOne({ _id: booking.management_agreement_id }, options);
    const payments = await repository.payments.find({ booking_id: bookingId, status: 'succeeded' }, options).exec();
    const deposit = await repository.deposits.findOne({ booking_id: bookingId }, options);
    const pickup = await repository.handovers.findOne({ booking_id: bookingId, handover_type: 'pickup', status: 'confirmed' }, options);
    const intake = await repository.intakes.findOne({ vehicle_id: booking.vehicle_id, $or: [{ status: 'completed' }, { status: { $exists: false } }] }, { ...options, sort: { odometer_km: -1 } });
    const lastReturn = await repository.handovers.findOne({ vehicle_id: booking.vehicle_id, handover_type: 'return', status: 'confirmed' }, { ...options, sort: { odometer_km: -1 } });
    const baseline = type === 'return' ? pickup : (Number(lastReturn?.odometer_km || 0) > Number(intake?.odometer_km || 0) ? lastReturn : intake);
    const blockers = [];
    const add = (code, message) => blockers.push({ code, message });
    const now = new Date();
    if (booking.status !== (type === 'pickup' ? 'confirmed' : 'ongoing')) add('BOOKING_STATUS', type === 'pickup' ? 'Đơn thuê chưa được xác nhận hoặc đã bàn giao.' : 'Đơn thuê không ở trạng thái đang thuê.');
    if (type === 'pickup') {
      if (vehicle.onboarding_status !== 'approved' || vehicle.physical_status !== 'at_garage') add('VEHICLE_NOT_READY', 'Xe chưa được duyệt hoặc chưa sẵn sàng tại gara.');
      if (!agreement || agreement.status !== 'signed' || !agreement.signed_at || agreement.signing_info?.renter_confirmed !== true || !agreement.signing_info?.platform_signer_user_id || !same(agreement.management_agreement_id, booking.management_agreement_id)) add('RENTAL_NOT_SIGNED', 'Hợp đồng thuê chưa được ký/xác nhận đầy đủ.');
      if (!management || !same(management.vehicle_id, booking.vehicle_id) || management.status !== 'active' || !management.signature_info?.owner_signed_at || !management.signature_info?.platform_signed_at || !management.authorization_scope?.vehicle_custody || !management.authorization_scope?.rental_contract_signing || !(management.start_date <= now && management.end_date >= booking.end_at)) add('MANAGEMENT_NOT_ACTIVE', 'Hợp đồng quản lý hoặc quyền cho thuê/lưu giữ xe chưa hợp lệ.');
      if (!renter || renter.account_status !== 'active' || renter.identity_kyc?.status !== 'verified' || renter.driver_license?.verification_status !== 'verified' || !(renter.driver_license?.expires_at >= booking.end_at)) add('RENTER_NOT_VERIFIED', 'Khách thuê chưa có hồ sơ và giấy phép lái xe hợp lệ.');
      const netRental = payments.filter((item) => ['rental_payment', 'rental_refund'].includes(item.transaction_type)).reduce((sum, item) => sum + (item.direction === 'in' ? 1 : -1) * item.amount, 0);
      if (!Number.isFinite(booking.rental_fee_amount) || booking.rental_fee_amount < 0 || !Number.isFinite(netRental) || netRental < booking.rental_fee_amount) add('RENTAL_UNPAID', 'Chưa xác nhận đủ tiền thuê.');
      const required = booking.deposit_amount_snapshot;
      const collected = payments.filter((item) => item.transaction_type === 'deposit_collection' && item.direction === 'in').reduce((sum, item) => sum + item.amount, 0);
      if (!Number.isFinite(required) || required < 0 || (required > 0 && (!deposit || deposit.status !== 'collected' || !Number.isFinite(deposit.collected_amount) || deposit.collected_amount - (deposit.refunded_amount || 0) - (deposit.deducted_amount || 0) < required || !Number.isFinite(collected) || collected < required))) add('DEPOSIT_UNPAID', 'Chưa xác nhận đủ tiền đặt cọc.');
    } else {
      if (!pickup) add('PICKUP_MISSING', 'Chưa có biên bản bàn giao để đối chiếu.');
      if (vehicle.physical_status !== 'rented') add('VEHICLE_NOT_RENTED', 'Xe không ở trạng thái đang cho thuê.');
    }
    return { booking, vehicle, renter: renter ? { _id: renter._id, full_name: renter.full_name } : null, pickup, baselineOdometerKm: baseline?.odometer_km || 0, baselineFuelPct: baseline?.fuel_level_pct || 0, baselineCondition: baseline?.vehicle_condition || baseline?.condition_snapshot || {}, eligible: !blockers.length, blockers };
  }
  async function getRecord(id, session) {
    const record = await repository.handovers.findOne({ _id: id }, session ? { session } : {});
    if (!record) throw httpError(404, 'Không tìm thấy biên bản giao nhận.');
    return record;
  }
  function requireOwner(record, actor) {
    if (!same(record.garage_staff_id, actor._id)) throw httpError(403, 'Chỉ người lập biên bản được sửa hoặc xác nhận.');
  }
  function validateReport(record, baseline) {
    if (!Number.isSafeInteger(record.odometer_km) || record.odometer_km < baseline) throw httpError(400, `Số km phải là số nguyên và không nhỏ hơn ${baseline} km.`);
    if (!Number.isSafeInteger(record.fuel_level_pct) || record.fuel_level_pct < 0 || record.fuel_level_pct > 100) throw httpError(400, 'Mức nhiên liệu/pin phải từ 0 đến 100%.');
    if (fields.some((key) => !['good', 'attention', 'damaged'].includes(record.vehicle_condition?.[key]))) throw httpError(400, 'Cần đánh giá đầy đủ 4 hạng mục tình trạng xe.');
    if (fields.some((key) => record.vehicle_condition[key] !== 'good') && !record.vehicle_condition.note?.trim()) throw httpError(400, 'Cần ghi chú hiện trạng bất thường.');
  }
  return {
    context,
    async get(id) {
      const record = await getRecord(id);
      return { ...record, eligibility: await context(record.booking_id, record.handover_type) };
    },
    async create(draft, actor) {
      await ensureIndexes();
      const data = await context(draft.booking_id, draft.handover_type);
      if (data.booking.status !== (draft.handover_type === 'pickup' ? 'confirmed' : 'ongoing')) throw httpError(409, 'Đơn thuê chưa ở trạng thái có thể lập biên bản này.');
      try {
        return await repository.handovers.create({ ...draft, vehicle_id: data.booking.vehicle_id, garage_staff_id: actor._id, status: 'draft', version: 0, created_at: new Date(), updated_at: new Date() });
      } catch (error) {
        if (error.code === 11000) throw httpError(409, 'Đơn thuê đã có biên bản loại này. Vui lòng tải lại danh sách.');
        throw error;
      }
    },
    async update(id, draft, actor) {
      const record = await getRecord(id);
      requireOwner(record, actor);
      if (record.status !== 'draft') throw httpError(409, 'Biên bản đã xác nhận chỉ được xem.');
      const { version, ...changes } = draft;
      if (changes.vehicle_condition) changes.vehicle_condition = { ...record.vehicle_condition, ...changes.vehicle_condition };
      const updated = await repository.handovers.findOneAndUpdate({ _id: id, status: 'draft', version }, { $set: { ...changes, updated_at: new Date() }, $inc: { version: 1 } }, { returnDocument: 'after' });
      if (!updated) throw httpError(409, 'Biên bản đã thay đổi. Đóng và mở lại trước khi lưu.');
      return updated;
    },
    async confirm(id, version, actor) {
      await ensureIndexes();
      return garageTransaction(repository, async (session) => {
        const record = await getRecord(id, session);
        requireOwner(record, actor);
        if (complete(record) && record.confirmed_from_version === version) return { data: record, replayed: true };
        if (record.status !== 'draft' || record.version !== version) throw httpError(409, 'Biên bản đã thay đổi hoặc đã xác nhận.');
        const data = await context(record.booking_id, record.handover_type, session);
        if (!data.eligible) throw httpError(409, 'Chưa đủ điều kiện giao nhận.', { blockers: data.blockers });
        validateReport(record, data.baselineOdometerKm);
        const returning = record.handover_type === 'return';
        const abnormal = returning && fields.some((key) => rank(record.vehicle_condition[key]) > rank(data.baselineCondition[key]));
        const now = new Date();
        const bookingChange = await repository.bookings.updateOne({ _id: record.booking_id, status: returning ? 'ongoing' : 'confirmed' }, { $set: { status: returning ? 'completed' : 'ongoing', [returning ? 'actual_end_at' : 'actual_start_at']: now, updated_at: now }, $push: { status_history: { from: data.booking.status, to: returning ? 'completed' : 'ongoing', at: now, actor: String(actor._id) } } }, { session });
        const vehicleChange = await repository.vehicles.updateOne({ _id: record.vehicle_id, physical_status: returning ? 'rented' : 'at_garage' }, { $set: { physical_status: returning ? (abnormal ? 'maintenance' : 'at_garage') : 'rented', updated_at: now } }, { session });
        if (bookingChange.modifiedCount !== 1 || vehicleChange.modifiedCount !== 1) throw httpError(409, 'Đơn thuê hoặc trạng thái xe đã thay đổi.');
        const confirmed = await repository.handovers.findOneAndUpdate({ _id: id, status: 'draft', version }, { $set: { status: 'confirmed', occurred_at: now, renter_confirmed_at: now, 'vehicle_condition.renter_signature_recorded': true, confirmed_from_version: version, updated_at: now }, $inc: { version: 1 } }, { session, returnDocument: 'after' });
        if (!confirmed) throw httpError(409, 'Biên bản đã thay đổi.');
        if (abnormal) {
          const caseId = new Types.ObjectId();
          await repository.incidents.create({ _id: caseId, case_number: `SC-${caseId}`, vehicle_id: record.vehicle_id, booking_id: record.booking_id, source_handover_id: id, reported_by_user_id: actor._id, case_type: 'vehicle_damage', severity: 'medium', description: record.vehicle_condition.note, evidence: (record.vehicle_condition.photo_keys || []).map((file_key) => ({ kind: 'image', file_key, uploaded_by_user_id: actor._id })), investigation: { review_status: 'pending' }, status: 'reported', created_at: now, updated_at: now }, { session });
          await repository.auditLogs.create({ actor_user_id: actor._id, action: 'garage.incident.reported', entity_type: 'incident_case', entity_id: caseId, created_at: now, sanitized_changes: { source_handover_id: id } }, { session });
        }
        await repository.auditLogs.create({ actor_user_id: actor._id, action: returning ? 'garage.return.confirmed' : 'garage.pickup.confirmed', entity_type: 'rental_handover', entity_id: id, created_at: now, sanitized_changes: { vehicle_id: record.vehicle_id, booking_id: record.booking_id } }, { session });
        return { data: confirmed, replayed: false };
      });
    },
  };
}
