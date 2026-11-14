import { bookingHoldExpression, isBookingHoldExpired } from '../utils/booking-hold.js';
import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';
import { createManagementContractDocument, parseManagementTerms } from './management-contract-document.js';
import { createRentalContractDocument } from './rental-contract-document.js';
import { findPageRows } from '../utils/pagination.js';

const same = (a, b) => a && b && String(a) === String(b);
const oid = (value) => {
  if (!/^[a-f\d]{24}$/i.test(String(value || ''))) throw httpError(400, 'Mã hồ sơ không hợp lệ.');
  return new Types.ObjectId(String(value));
};
const checkType = (type) => {
  if (!['management', 'rental'].includes(type)) throw httpError(400, 'Loại hợp đồng không hợp lệ.');
};
const fail = (condition, message) => { if (condition) throw httpError(409, message); };
const date = (value) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

export function createContractService(repository) {
  async function actorInfo(actor) {
    const id = oid(actor.tokenPayload?.sub);
    const roleIds = [actor.user?.primary_role_id, ...(actor.user?.additional_role_ids || [])].filter(Boolean);
    const roles = await repository.roles.find({ _id: { $in: roleIds } }).exec();
    return {
      id,
      name: actor.user?.full_name || '',
      roles: roles.map((row) => row.code),
      permissions: [...new Set(roles.flatMap((row) => row.permissions || []))],
    };
  }
  const requireRole = (actor, roles) => {
    if (!actor.roles.some((role) => roles.includes(role))) throw httpError(403, 'Bạn không có quyền thực hiện thao tác hợp đồng này.');
  };
  async function transact(action) {
    const session = await repository.startSession();
    try { return await session.withTransaction(() => action(session)); }
    finally { await session.endSession(); }
  }
  async function audit(actor, type, id, action, changes, session) {
    await repository.audits.create({ actor_user_id: actor.id, entity_type: `${type}_agreement`, entity_id: id, action, sanitized_changes: changes, created_at: new Date() }, { session });
  }
  async function context(type, row, session) {
    const options = session ? { session } : {};
    const booking = type === 'rental' ? await repository.bookings.findOne({ _id: row.booking_id }, options) : null;
    if (type === 'rental' && !booking) throw httpError(404, 'Không tìm thấy booking của hợp đồng.');
    const vehicle = await repository.vehicles.findOne({ _id: booking?.vehicle_id || row.vehicle_id }, options);
    if (!vehicle) throw httpError(404, 'Không tìm thấy xe của hợp đồng.');
    const partyId = type === 'management' ? row.owner_id : booking.renter_id;
    return { booking, vehicle, partyId };
  }
  async function eligible(type, row, ctx, session) {
    const { vehicle, booking } = ctx, now = new Date();
    fail(vehicle.onboarding_status !== 'approved', 'Xe phải được Manager duyệt trước khi ký hợp đồng.');
    if (type === 'management') {
      fail(!Number.isFinite(row.commission_rate_pct) || row.commission_rate_pct < 0 || row.commission_rate_pct > 100, 'Tỷ lệ hoa hồng không hợp lệ.');
      fail(!['with_owner', 'returned_to_owner'].includes(vehicle.physical_status), 'Chỉ lập và ký hợp đồng tiếp nhận khi xe còn ở chủ xe.');
      const other = await repository.agreement('management').findOne({ vehicle_id: vehicle._id, _id: { $ne: row._id }, status: { $in: ['active', 'termination_requested'] } }, { session });
      fail(Boolean(other), 'Xe đã có hợp đồng quản lý còn hiệu lực; cần xử lý hợp đồng hiện tại trước.');
      fail(!same(row.owner_id, vehicle.owner_id), 'Hợp đồng không khớp chủ xe.');
      const latest = await repository.inspections.findOne({ vehicle_id: vehicle._id, inspection_type: 'onboarding' }, { session, sort: { created_at: -1, _id: -1 } });
      fail(latest?.approval_status !== 'approved' || latest?.recommendation !== 'pass', 'Cần biên bản kiểm định đạt đã được Manager duyệt.');
      fail(!(row.start_date instanceof Date) || !(row.end_date instanceof Date) || row.start_date >= row.end_date || row.end_date <= now, 'Thời hạn hợp đồng quản lý không hợp lệ.');
      fail(row.inspection_id && (!same(row.inspection_id, latest._id) || row.inspection_version !== (latest.version ?? 0)), 'Báo cáo kiểm định gắn với hợp đồng đã thay đổi.');
      return latest;
    } else {
      fail(!Number.isSafeInteger(booking.rental_fee_amount) || booking.rental_fee_amount < 0 || !Number.isSafeInteger(booking.deposit_amount_snapshot) || booking.deposit_amount_snapshot < 0 || !Number.isSafeInteger(booking.pricing_snapshot?.daily_price) || booking.pricing_snapshot.daily_price <= 0, 'Booking chưa có giá thuê và tiền cọc hợp lệ.');
      fail(booking.status !== 'awaiting_payment' || booking.start_at <= now || booking.end_at <= booking.start_at, 'Chỉ ký cho booking đã duyệt, còn hạn và chưa bắt đầu.');
      fail(isBookingHoldExpired(booking, now), 'Đã hết hạn ký và thanh toán của booking.');
      fail(same(booking.renter_id, vehicle.owner_id), 'Chủ xe không thể thuê chính xe của mình.');
      fail(vehicle.physical_status !== 'at_garage', 'Xe chưa sẵn sàng tại gara.');
      const management = await repository.agreement('management').findOne({ _id: booking.management_agreement_id }, { session });
      fail(!management || !same(management.vehicle_id, vehicle._id) || !same(management.owner_id, vehicle.owner_id) || management.status !== 'active' || !management.signature_info?.owner_signed_at || !management.signature_info?.platform_signed_at || !management.authorization_scope?.rental_contract_signing || !management.authorization_scope?.vehicle_custody || !(management.start_date <= now && management.end_date >= booking.end_at), 'Chưa có hợp đồng quản lý và quyền cho thuê hợp lệ.');
      const renter = await repository.users.findOne({ _id: booking.renter_id }, { session });
      fail(!renter || renter.account_status !== 'active' || renter.identity_kyc?.status !== 'verified' || renter.driver_license?.verification_status !== 'verified' || !(renter.driver_license.expires_at >= booking.end_at), 'Khách thuê cần danh tính và GPLX hợp lệ đến hết chuyến.');
      fail(!same(row.management_agreement_id, management._id), 'Hợp đồng thuê không khớp hợp đồng quản lý.');
      if (row.contract_document) {
        fail(!same(row.renter_details_snapshot?.renter_id, booking.renter_id) || !same(row.lender_details_snapshot?.owner_id, vehicle.owner_id), 'Các bên của booking đã thay đổi sau khi lập hợp đồng.');
        const terms = row.terms_snapshot;
        fail(!terms || terms.rental_fee_amount !== booking.rental_fee_amount || terms.deposit_amount !== booking.deposit_amount_snapshot || +terms.start_at !== +booking.start_at || +terms.end_at !== +booking.end_at || terms.daily_rate !== booking.pricing_snapshot?.daily_price, 'Booking đã thay đổi sau khi lập hợp đồng. Cần lập lại hồ sơ trước khi ký.');
      }
    }
  }
  async function access(type, row, actor, mode, session) {
    const ctx = await context(type, row, session);
    if (mode === 'party') {
      requireRole(actor, type === 'management' ? ['OWNER', 'CAR_OWNER'] : ['RENTER']);
      if (!same(ctx.partyId, actor.id)) throw httpError(404, 'Không tìm thấy hợp đồng thuộc tài khoản của bạn.');
    } else requireRole(actor, ['MANAGER', 'OPERATION_STAFF']);
    return ctx;
  }
  function serialize(type, row, ctx, mode, actor) {
    const signature = type === 'management' ? row.signature_info || {} : row.signing_info || {};
    const partyAt = type === 'management' ? signature.owner_signed_at : signature.renter_signed_at;
    const platformAt = signature.platform_signed_at;
    const partyDone = Boolean(partyAt || (type === 'rental' && signature.renter_confirmed));
    const platformDone = Boolean(platformAt || (type === 'rental' && signature.platform_signer_user_id));
    const operatorIntakeConfirmedAt = row.operator_intake?.confirmed_at || null;
    const signingOpen = type !== 'rental' || (ctx.booking.status === 'awaiting_payment' && ctx.booking.start_at > new Date() && !isBookingHoldExpired(ctx.booking));
    return {
      id: String(row._id), type, number: row.agreement_number || row.contract_number, status: row.status,
      vehicle: `${ctx.vehicle.brand || ''} ${ctx.vehicle.model || ''} · ${ctx.vehicle.license_plate}`,
      commissionRatePct: row.commission_rate_pct, startDate: row.start_date, endDate: row.end_date,
      signature, document: row.contract_document || null, terms: row.contract_document?.clauses || [],
      partySigned: partyDone, partySignedAt: partyAt || null,
      platformSigned: platformDone, platformSignedAt: platformAt || null,
      operatorIntakeConfirmedAt,
      partyName: signature.owner_signature_name || signature.renter_signature_name || '', platformName: signature.platform_signature_name || '',
      canSign: Boolean(signingOpen && row.contract_document && row.status === 'pending_signatures'
        && (mode === 'party' ? !partyDone : actor.roles.includes('MANAGER') && partyDone && operatorIntakeConfirmedAt && !platformDone)),
      canOperatorConfirm: Boolean(
        mode === 'staff'
        && actor.roles.includes('OPERATION_STAFF')
        && actor.permissions.includes('operation.contract.intake.confirm')
        && signingOpen
        && row.contract_document
        && row.status === 'pending_signatures'
        && partyDone
        && !platformDone
        && !operatorIntakeConfirmedAt,
      ),
      canOwnerSign: Boolean(type === 'management' && mode === 'party' && row.contract_document && row.status === 'pending_signatures' && !partyDone),
      canPrepare: Boolean(signingOpen && !row.contract_document && !partyDone && !platformDone && ['draft', 'pending_signatures', 'pending_signature', 'awaiting_signature'].includes(row.status) && (type === 'rental' || ctx.vehicle.onboarding_status === 'approved')),
    };
  }
  return {
    async list(type, query, rawActor, mode = 'party') {
      checkType(type); const actor = await actorInfo(rawActor);
      let filter = {};
      if (query.status && query.status !== 'all') {
        if (typeof query.status !== 'string' || query.status.length > 40) throw httpError(400, 'status không hợp lệ.');
        filter.status = query.status;
      }
      if (mode === 'party') {
        requireRole(actor, type === 'management' ? ['OWNER', 'CAR_OWNER'] : ['RENTER']);
        if (type === 'management') filter.owner_id = actor.id;
        else filter.booking_id = { $in: (await repository.bookings.find({ renter_id: actor.id }, { projection: { _id: 1 } }).exec()).map((row) => row._id) };
      } else {
        requireRole(actor, ['MANAGER', 'OPERATION_STAFF']);
        if (type === 'management') {
          const approvedVehicles = await repository.vehicles.find({ onboarding_status: 'approved' }, { projection: { _id: 1 } }).exec();
          filter.vehicle_id = { $in: approvedVehicles.map((vehicle) => vehicle._id) };
        }
      }
      if (query.q !== undefined) {
        if (typeof query.q !== 'string' || query.q.length > 100) throw httpError(400, 'q không hợp lệ.');
        const q = query.q.trim();
        if (q) {
          const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          filter[type === 'management' ? 'agreement_number' : 'contract_number'] = new RegExp(`^${escaped}$`, 'i');
        }
      }
      const rows = await findPageRows(repository.agreement(type), filter, { ...query, page: query.page ?? '1', limit: query.limit ?? '10' }, { sort: { created_at: -1 } });
      const data = [];
      for (const row of rows) data.push(serialize(type, row, await context(type, row), mode, actor));
      return { data, pagination: rows.pagination };
    },
    async detail(type, id, rawActor, mode = 'party') {
      checkType(type); const actor = await actorInfo(rawActor);
      const row = await repository.agreement(type).findOne({ _id: oid(id) });
      if (!row) throw httpError(404, 'Không tìm thấy hợp đồng.');
      return serialize(type, row, await access(type, row, actor, mode), mode, actor);
    },
    async confirmOperatorIntake(type, idValue, rawActor) {
      checkType(type);
      const actor = await actorInfo(rawActor);
      requireRole(actor, ['OPERATION_STAFF']);
      if (!actor.permissions.includes('operation.contract.intake.confirm')) {
        throw httpError(403, 'Bạn không có quyền tiếp nhận hợp đồng.');
      }

      return transact(async (session) => {
        const agreementRepository = repository.agreement(type);
        const id = oid(idValue);
        const row = await agreementRepository.findOne({ _id: id }, { session });
        if (!row) throw httpError(404, 'Không tìm thấy hợp đồng.');
        const ctx = await access(type, row, actor, 'staff', session);
        if (same(actor.id, ctx.partyId) || same(actor.id, ctx.vehicle.owner_id)) {
          throw httpError(403, 'Không thể tiếp nhận hợp đồng của chính mình.');
        }
        fail(row.status !== 'pending_signatures' || !row.contract_document || typeof row.contract_document.hash !== 'string', 'Hợp đồng chưa sẵn sàng để Operator tiếp nhận.');
        const signature = type === 'management' ? row.signature_info || {} : row.signing_info || {};
        const partySigned = type === 'management'
          ? Boolean(signature.owner_signed_at)
          : Boolean(signature.renter_signed_at || signature.renter_confirmed);
        const platformSigned = Boolean(signature.platform_signed_at || (type === 'rental' && signature.platform_signer_user_id));
        fail(!partySigned, 'Cần có xác nhận của chủ xe/người thuê trước khi tiếp nhận.');
        fail(platformSigned, 'Manager đã xác nhận hợp đồng phía XeDi.');
        fail(row.operator_intake?.confirmed_at, 'Hợp đồng đã được Operator tiếp nhận.');
        await eligible(type, row, ctx, session);

        const now = new Date();
        const updated = await agreementRepository.findOneAndUpdate({
          _id: id,
          status: 'pending_signatures',
          'contract_document.hash': row.contract_document.hash,
          'operator_intake.confirmed_at': { $exists: false },
        }, {
          $set: {
            operator_intake: { confirmed_by_operator_id: actor.id, confirmed_at: now },
            updated_at: now,
          },
        }, { session, returnDocument: 'after' });
        if (!updated) throw httpError(409, 'Hợp đồng vừa được thay đổi; hãy tải lại trước khi tiếp nhận.');
        await audit(actor, type, id, 'contract.operator_intake.confirm', {
          document_hash: row.contract_document.hash,
        }, session);
        return { data: serialize(type, updated, ctx, 'staff', actor) };
      });
    },
    async candidates(type, query, rawActor) {
      checkType(type); const actor = await actorInfo(rawActor);
      requireRole(actor, type === 'management' ? ['MANAGER'] : ['MANAGER', 'OPERATION_STAFF']);
      const repo = type === 'management' ? repository.vehicles : repository.bookings;
      const now = new Date();
      const filter = type === 'management'
        ? { onboarding_status: 'approved', physical_status: { $in: ['with_owner', 'returned_to_owner'] } }
        : { status: 'awaiting_payment', start_at: { $gt: now },
          $expr: { $or: [{ $eq: [bookingHoldExpression, null] }, { $gt: [bookingHoldExpression, now] }] } };

      if (type === 'management') {
        const existing = await repository.agreement('management').find({
          status: { $nin: ['terminated', 'expired', 'cancelled'] },
          $or: [
            { contract_document: { $exists: true } },
            { status: { $in: ['active', 'termination_requested'] } },
          ],
        }, { projection: { vehicle_id: 1 } }).exec();
        const excluded = [...new Map(existing.map((row) => [String(row.vehicle_id), row.vehicle_id])).values()];
        if (excluded.length) filter._id = { $nin: excluded };
      }
      if (type === 'rental') {
        const prepared = await repository.agreement('rental').find({ contract_document: { $exists: true } }, { projection: { booking_id: 1 } }).exec();
        if (prepared.length) filter._id = { $nin: prepared.map((row) => row.booking_id) };
      }
      const rows = await findPageRows(repo, filter, { ...query, page: query.page ?? '1', limit: query.limit ?? '10' });
      return { data: rows.map((row) => ({ id: String(row._id), label: type === 'management' ? `${row.brand} ${row.model} · ${row.license_plate}` : `${row.booking_code} · ${date(row.start_at)}` })), pagination: rows.pagination };
    },
    async prepare(type, referenceId, body, rawActor) {
      checkType(type); const actor = await actorInfo(rawActor);
      requireRole(actor, type === 'management' ? ['MANAGER'] : ['MANAGER', 'OPERATION_STAFF']);
      return transact(async (session) => {
        const now = new Date(), reference = oid(referenceId), repo = repository.agreement(type);
        let row = await repo.findOne(type === 'management' ? { vehicle_id: reference, status: { $nin: ['terminated', 'expired', 'cancelled'] } } : { booking_id: reference }, { session });
        if (row?.contract_document) return serialize(type, row, await access(type, row, actor, 'staff', session), 'staff', actor);
        fail(row && !['draft', 'pending_signatures', 'pending_signature', 'awaiting_signature'].includes(row.status), 'Hợp đồng đã ký hoặc đã kết thúc; không được thay nội dung.');
        fail(row && (row.signature_info?.owner_signed_at || row.signature_info?.platform_signed_at || row.signing_info?.renter_confirmed || row.signing_info?.platform_signer_user_id), 'Không được thay nội dung hợp đồng đã có chữ ký.');
        const booking = type === 'rental' ? await repository.bookings.findOne({ _id: reference }, { session }) : null;
        if (type === 'rental' && !booking) throw httpError(404, 'Không tìm thấy booking.');
        const vehicle = await repository.vehicles.findOne({ _id: booking?.vehicle_id || reference }, { session });
        if (!vehicle) throw httpError(404, 'Không tìm thấy xe.');
        const newId = row?._id || new Types.ObjectId();
        const dateField = (value, endOfDay = false) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`) : new Date(value);
        const start = body.startDate ? dateField(body.startDate) : now;
        const end = body.endDate ? dateField(body.endDate, true) : new Date(start.getTime() + 365 * 86400000);
        if (type === 'management' && (!Number.isFinite(+start) || !Number.isFinite(+end))) throw httpError(400, 'Ngày hợp đồng không hợp lệ.');
        const managementTerms = type === 'management' ? parseManagementTerms(body, row) : null;
        row = { ...row, _id: newId, status: 'pending_signatures', created_at: row?.created_at || now, updated_at: now,
          ...(type === 'management' ? { vehicle_id: vehicle._id, owner_id: vehicle.owner_id, agreement_number: row?.agreement_number || `MGMT-${newId}`, start_date: start, end_date: end, commission_rate_pct: managementTerms.commission, authorization_scope: { vehicle_custody: true, rental_contract_signing: true, listing_management: true, booking_management: true, owner_confirmation_per_booking: false, commission_basis: 'rental_fee_excluding_security_deposit' } } : { booking_id: reference, management_agreement_id: booking.management_agreement_id, contract_number: row?.contract_number || `RENT-${newId}`, terms_snapshot: { ...row?.terms_snapshot, daily_rate: booking.pricing_snapshot?.daily_price, rental_fee_amount: booking.rental_fee_amount, deposit_amount: booking.deposit_amount_snapshot, start_at: booking.start_at, end_at: booking.end_at, signature_method: 'electronic_acceptance' }, renter_details_snapshot: { ...row?.renter_details_snapshot, renter_id: booking.renter_id, verified_license: true }, lender_details_snapshot: { ...row?.lender_details_snapshot, owner_id: vehicle.owner_id } }) };
        const ctx = { vehicle, booking, partyId: booking?.renter_id || vehicle.owner_id };
        const inspection = await eligible(type, row, ctx, session);
        if (inspection) {
          row.inspection_id = inspection._id;
          row.inspection_version = inspection.version ?? 0;
        }
        const party = await repository.users.findOne({ _id: ctx.partyId }, { session });
        const owner = await repository.users.findOne({ _id: vehicle.owner_id }, { session });
        row.contract_document = type === 'management'
          ? createManagementContractDocument({ row, owner, vehicle, inspection, terms: managementTerms, now })
          : createRentalContractDocument({ row, booking, vehicle, owner, renter: party, now });
        const exists = await repo.findOne({ _id: newId }, { session });
        if (exists) { const { _id, ...set } = row; await repo.updateOne({ _id }, { $set: set }, { session }); }
        else await repo.create(row, { session });
        await repository.vehicles.updateOne({ _id: vehicle._id }, { $inc: { contract_workflow_version: 1 } }, { session });
        await audit(actor, type, row._id, 'contract.prepare', { document_hash: row.contract_document.hash }, session);
        return serialize(type, row, ctx, 'staff', actor);
      });
    },
    async sign(type, id, body, rawActor, mode = 'party') {
      checkType(type); const actor = await actorInfo(rawActor);
      if (body?.acceptedTerms !== true || typeof body.signatureName !== 'string' || body.signatureName.trim().length < 2 || body.signatureName.trim().length > 120) throw httpError(400, 'Cần nhập tên người ký và xác nhận đồng ý điều khoản.');
      return transact(async (session) => {
        const repo = repository.agreement(type), row = await repo.findOne({ _id: oid(id) }, { session });
        if (!row) throw httpError(404, 'Không tìm thấy hợp đồng.');
        const ctx = await access(type, row, actor, mode, session);
        if (mode !== 'party') {
          requireRole(actor, ['MANAGER']);
          if (same(actor.id, ctx.partyId) || same(actor.id, ctx.vehicle.owner_id)) throw httpError(403, 'Không được đại diện nền tảng ký hợp đồng của chính mình.');
          const signature = type === 'management' ? row.signature_info || {} : row.signing_info || {};
          const partySigned = type === 'management'
            ? Boolean(signature.owner_signed_at)
            : Boolean(signature.renter_signed_at || signature.renter_confirmed);
          fail(!partySigned, 'Hợp đồng cần được chủ xe/người thuê xác nhận trước.');
          fail(!row.operator_intake?.confirmed_at, 'Operator chưa tiếp nhận hợp đồng.');
        }
        fail(!row.contract_document || row.status !== 'pending_signatures', 'Hợp đồng chưa sẵn sàng ký hoặc đã ký xong.');
        fail(body.documentHash !== row.contract_document.hash, 'Nội dung hợp đồng đã thay đổi. Vui lòng mở lại trước khi ký.');
        await eligible(type, row, ctx, session);
        const now = new Date(), name = body.signatureName.trim();
        const infoKey = type === 'management' ? 'signature_info' : 'signing_info';
        const signature = { ...(row[infoKey] || {}), method: 'electronic_acceptance', terms_version: row.contract_document.version };
        const partyAt = type === 'management' ? 'owner_signed_at' : 'renter_signed_at';
        fail(mode === 'party' ? Boolean(signature[partyAt] || signature.renter_confirmed) : Boolean(signature.platform_signed_at || (type === 'rental' && signature.platform_signer_user_id)), 'Bên này đã ký hợp đồng.');
        if (mode === 'party') {
          signature[partyAt] = now;
          signature[type === 'management' ? 'owner_signature_name' : 'renter_signature_name'] = name;
          signature[type === 'management' ? 'owner_signer_user_id' : 'renter_signer_user_id'] = actor.id;
          if (type === 'rental') signature.renter_confirmed = true;
        } else { signature.platform_signed_at = now; signature.platform_signature_name = name; if (type === 'rental') signature.platform_signer_user_id = actor.id; }
        const complete = signature[partyAt] && signature.platform_signed_at;
        const set = { [infoKey]: signature, status: complete ? (type === 'management' ? 'active' : 'signed') : 'pending_signatures', updated_at: now };
        if (type === 'management' && mode !== 'party') set.platform_signer_id = actor.id;
        if (type === 'rental' && complete) set.signed_at = now;
        await repo.updateOne({ _id: row._id, status: 'pending_signatures' }, { $set: set }, { session });
        await repository.vehicles.updateOne({ _id: ctx.vehicle._id }, { $inc: { contract_workflow_version: 1 } }, { session });
        if (ctx.booking) await repository.bookings.updateOne({ _id: ctx.booking._id }, { $inc: { contract_workflow_version: 1 } }, { session });
        await audit(actor, type, row._id, 'contract.sign', { sign_as: mode === 'party' ? 'party' : 'platform', document_hash: row.contract_document.hash, terms_version: signature.terms_version }, session);
        return serialize(type, { ...row, ...set }, ctx, mode, actor);
      });
    },
  };
}
