import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';
import { garageTransaction } from '../utils/garage-transaction.js';

const fields = ['exterior', 'interior', 'engine', 'tires'];
const vehicleProjection = { brand: 1, model: 1, license_plate: 1, onboarding_status: 1, physical_status: 1 };
const same = (a, b) => a && b && String(a) === String(b);
const complete = (record) => record?.status === 'confirmed';
const rank = (condition) => condition === 'damaged' ? 2 : condition === 'attention' ? 1 : 0;

function compareDefects(before, after) {
  const baseline = new Map((before?.defects || []).map((item) => [item.code, item]));
  const current = after?.defects || [];
  const currentCodes = new Set(current.map((item) => item.code));
  return [
    ...current.map((item) => {
      const original = baseline.get(item.code);
      let change = 'unchanged';
      if (!original) change = 'new';
      else if (original.location !== item.location) change = 'unverified';
      else if (rank(item.severity) > rank(original.severity)) change = 'worsened';
      else if (item.description !== original.description || item.severity !== original.severity) change = 'unverified';
      return { code: item.code, change };
    }),
    ...[...baseline.keys()].filter((code) => !currentCodes.has(code)).map((code) => ({ code, change: 'unverified' })),
  ];
}

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
    const renter = await repository.users.findOne({ _id: booking.renter_id }, { ...options, projection: { full_name: 1, account_status: 1 } });
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
      if (!renter || renter.account_status !== 'active') add('RENTER_INACTIVE', 'Tài khoản khách thuê không còn hoạt động.');
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
    if ((record.vehicle_condition.defects || []).some((item) => !record.vehicle_condition.photo_keys?.includes(item.photo_key)))
      throw httpError(400, 'Ảnh của từng lỗi phải còn trong biên bản.');
    if (fields.some((key) => record.vehicle_condition[key] !== 'good') && !record.vehicle_condition.note?.trim()) throw httpError(400, 'Cần ghi chú hiện trạng bất thường.');
  }
  async function withdrawalContext(id, session) {
    const options = { session };
    const withdrawal = await repository.withdrawals.findOne({ _id: id, request_type: 'owner_withdrawal' }, options);
    if (!withdrawal) throw httpError(404, 'Không tìm thấy yêu cầu trả xe cho chủ.');
    const vehicle = await repository.vehicles.findOne({ _id: withdrawal.vehicle_id, owner_id: withdrawal.owner_id }, options);
    const intake = await repository.intakes.findOne({ vehicle_id: withdrawal.vehicle_id,
      management_agreement_id: withdrawal.management_agreement_id, status: 'completed' }, options);
    if (!vehicle || !['at_garage', 'maintenance'].includes(vehicle.physical_status)
      || !intake || !['requested', 'processing'].includes(withdrawal.status))
      throw httpError(409, 'Xe chưa đủ điều kiện bàn giao lại cho chủ.');
    const agreement = await repository.managementAgreements.findOne({ _id: withdrawal.management_agreement_id,
      vehicle_id: vehicle._id, owner_id: withdrawal.owner_id, status: { $in: ['termination_requested', 'terminated', 'expired'] } }, options);
    if (!agreement) throw httpError(409, 'Cần hoàn tất yêu cầu chấm dứt quyền cho thuê trước khi trả xe.');
    const active = await repository.bookings.findOne({ vehicle_id: vehicle._id,
      status: { $in: ['pending', 'awaiting_payment', 'confirmed', 'ongoing', 'in_progress'] } }, options);
    if (active) throw httpError(409, 'Xe còn booking cần xử lý trước khi giao lại chủ.');
    return { withdrawal, vehicle, intake };
  }

  return {
    context,
    async saveOwnerReturn(id, draft, actor) {
      const { withdrawal, intake } = await withdrawalContext(id);
      const previous = withdrawal.owner_return_handover;
      if (previous?.garage_staff_id && !same(previous.garage_staff_id, actor._id))
        throw httpError(403, 'Chỉ người lập biên bản được chỉnh sửa.');
      const { version, condition_snapshot, ...values } = draft;
      validateReport({ ...values, vehicle_condition: condition_snapshot }, intake.odometer_km || 0);
      if (!condition_snapshot.photo_keys?.length || (intake.received_at && values.returned_at < intake.received_at))
        throw httpError(400, 'Cần ảnh xe và giờ bàn giao sau lúc tiếp nhận.');
      if (!previous && version !== 0) throw httpError(409, 'Biên bản đã thay đổi. Tải lại trước khi lưu.');
      const versionMatch = previous ? { 'owner_return_handover.version': version } : { owner_return_handover: { $exists: false } };
      const updated = await repository.withdrawals.findOneAndUpdate({ _id: id, status: withdrawal.status, ...versionMatch }, {
        $set: { status: 'processing', owner_return_handover: {
          ...values, condition: condition_snapshot, garage_staff_id: actor._id, intake_id: intake._id, version: version + 1,
          damage_changes: compareDefects(intake.condition_snapshot, condition_snapshot),
        } },
      }, { returnDocument: 'after' });
      if (!updated) throw httpError(409, 'Biên bản đã thay đổi. Tải lại trước khi lưu.');
      return updated;
    },
    async confirmOwnerReturn(id, { version, review }) {
      return garageTransaction(repository, async (session) => {
        const scoped = await repository.withdrawals.findOne({ _id: id, owner_id: review.owner_id }, { session });
        if (!scoped) throw httpError(404, 'Không tìm thấy yêu cầu thuộc chủ xe.');
        if (scoped.status === 'withdrawn' && scoped.owner_return_handover?.version === version) return scoped;
        const { withdrawal, vehicle } = await withdrawalContext(id, session);
        const report = withdrawal.owner_return_handover;
        if (!report || report.version !== version) throw httpError(409, 'Biên bản đã thay đổi hoặc Garage chưa lập biên bản.');
        const now = new Date();
        const updated = await repository.vehicles.updateOne({ _id: vehicle._id, owner_id: review.owner_id, physical_status: vehicle.physical_status },
          { $set: { physical_status: 'returned_to_owner', updated_at: now } }, { session });
        if (updated.modifiedCount !== 1) throw httpError(409, 'Trạng thái xe vừa thay đổi.');
        await repository.listings.updateMany({ vehicle_id: vehicle._id, status: 'published' }, { $set: { status: 'suspended', updated_at: now } }, { session });
        const completed = await repository.withdrawals.findOneAndUpdate({ _id: id, status: 'processing', 'owner_return_handover.version': version }, {
          $set: { status: 'withdrawn', completed_at: now, 'owner_return_handover.owner_confirmed_at': now,
            'owner_return_handover.owner_response': review.status, 'owner_return_handover.owner_note': review.note },
        }, { session, returnDocument: 'after' });
        if (!completed) throw httpError(409, 'Biên bản vừa được xử lý.');
        if (review.status === 'disputed') await repository.incidents.create({
          case_number: `SC-RUT-${id}`, vehicle_id: vehicle._id, reported_by_user_id: review.owner_id,
          case_type: 'dispute', severity: 'medium', status: 'reported', description: review.note,
          source_withdrawal_id: id,
          evidence: report.condition.photo_keys.map((file_key) => ({ kind: 'image', file_key })), created_at: now,
        }, { session });
        await repository.auditLogs.create({ actor_user_id: review.owner_id, action: 'garage.owner_return.confirmed',
          entity_type: 'vehicle_withdrawal_request', entity_id: id, created_at: now, sanitized_changes: { owner_response: review.status } }, { session });
        return completed;
      });
    },
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
    async confirm(id, { version, renterConfirmed, note, occurredAt }, actor) {
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
        if (!returning && !renterConfirmed) throw httpError(400, 'Khách phải xác nhận trước khi giao xe.');
        if (!renterConfirmed && !record.vehicle_condition.photo_keys?.length)
          throw httpError(400, 'Cần ảnh hiện trạng khi nhận xe mà chưa có xác nhận của khách.');
        const now = new Date();
        const actualAt = occurredAt || now;
        if (returning && data.booking.actual_start_at && actualAt < data.booking.actual_start_at)
          throw httpError(400, 'Giờ trả thực tế phải sau giờ nhận xe.');
        const currentDefects = record.vehicle_condition.defects || [];
        const damageChanges = returning ? compareDefects(data.baselineCondition, record.vehicle_condition) : [];
        const abnormal = returning && (fields.some((key) => rank(record.vehicle_condition[key]) > rank(data.baselineCondition[key]))
          || damageChanges.some((item) => item.change !== 'unchanged'));
        const needsCase = abnormal || !renterConfirmed;
        const bookingChange = await repository.bookings.updateOne({ _id: record.booking_id, status: returning ? 'ongoing' : 'confirmed' }, { $set: { status: returning ? 'completed' : 'ongoing', [returning ? 'actual_end_at' : 'actual_start_at']: actualAt, updated_at: now }, $push: { status_history: { from: data.booking.status, to: returning ? 'completed' : 'ongoing', at: now, actor: String(actor._id) } } }, { session });
        const vehicleChange = await repository.vehicles.updateOne({ _id: record.vehicle_id, physical_status: returning ? 'rented' : 'at_garage' }, { $set: { physical_status: returning ? (abnormal ? 'maintenance' : 'at_garage') : 'rented', updated_at: now } }, { session });
        if (bookingChange.modifiedCount !== 1 || vehicleChange.modifiedCount !== 1) throw httpError(409, 'Đơn thuê hoặc trạng thái xe đã thay đổi.');
        const confirmed = await repository.handovers.findOneAndUpdate({ _id: id, status: 'draft', version }, { $set: { status: 'confirmed', occurred_at: actualAt, renter_response: renterConfirmed ? 'accepted' : 'not_confirmed',
          ...(renterConfirmed ? { renter_confirmed_at: now } : { renter_dispute_note: note }),
          'vehicle_condition.renter_signature_recorded': renterConfirmed,
          ...(returning ? { baseline_handover_id: data.pickup._id, damage_changes: damageChanges } : {}), confirmed_from_version: version, updated_at: now }, $inc: { version: 1 } }, { session, returnDocument: 'after' });
        if (!confirmed) throw httpError(409, 'Biên bản đã thay đổi.');
        if (needsCase) {
          const caseId = new Types.ObjectId();
          await repository.incidents.create({ _id: caseId, case_number: `SC-${caseId}`, vehicle_id: record.vehicle_id, booking_id: record.booking_id, source_handover_id: id, reported_by_user_id: actor._id, case_type: abnormal ? 'vehicle_damage' : 'dispute', severity: 'medium',
            description: [record.vehicle_condition.note, ...currentDefects.filter((item) => damageChanges.some((change) => change.code === item.code && change.change !== 'unchanged')).map((item) => `${item.location}: ${item.description}`), !renterConfirmed ? note : ''].filter(Boolean).join('\n').slice(0, 3000) || 'Cần xác minh chênh lệch hiện trạng khi nhận xe.', evidence: (record.vehicle_condition.photo_keys || []).map((file_key) => ({ kind: 'image', file_key, uploaded_by_user_id: actor._id })), investigation: { review_status: 'pending' }, status: 'reported', created_at: now, updated_at: now }, { session });
          await repository.auditLogs.create({ actor_user_id: actor._id, action: 'garage.incident.reported', entity_type: 'incident_case', entity_id: caseId, created_at: now, sanitized_changes: { source_handover_id: id } }, { session });
        }
        await repository.auditLogs.create({ actor_user_id: actor._id, action: returning ? 'garage.return.confirmed' : 'garage.pickup.confirmed', entity_type: 'rental_handover', entity_id: id, created_at: now, sanitized_changes: { vehicle_id: record.vehicle_id, booking_id: record.booking_id } }, { session });
        return { data: confirmed, replayed: false };
      });
    },
  };
}
