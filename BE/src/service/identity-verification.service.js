import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';

const { ObjectId } = Types;
const ALLOWED_EKYC_ROLES = new Set(['OWNER', 'CAR_OWNER']);
const allowedFiles = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const statuses = new Set(['pending', 'verified', 'revision_required', 'rejected']);
const mask = (value) => `***${value.replace(/\s/g, '').slice(-4)}`;

function validFile(input, label) {
  if (!input || typeof input !== 'object' || typeof input.name !== 'string' || !allowedFiles.has(input.contentType) || typeof input.data !== 'string') throw httpError(400, `${label} phải là ảnh JPG, PNG, WebP hoặc PDF.`);
  const encoded = input.data.replace(/^data:[^,]+;base64,/, '');
  if (!/^[A-Za-z\d+/]*={0,2}$/.test(encoded)) throw httpError(400, `${label} không hợp lệ.`);
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw httpError(400, `${label} không được vượt quá 4 MB.`);
  const signatures = {
    'application/pdf': bytes.subarray(0, 5).toString('ascii') === '%PDF-',
    'image/jpeg': bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    'image/png': bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/webp': bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
  };
  if (!signatures[input.contentType]) throw httpError(400, `${label} có nội dung không khớp định dạng đã chọn.`);
  return { name: input.name.slice(0, 120), contentType: input.contentType, bytes };
}
function text(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw httpError(400, `${label} không hợp lệ.`);
  return value.trim();
}
async function requireEkycUser(repository, actor) {
  const id = actor?.tokenPayload?.sub;
  if (!ObjectId.isValid(id)) throw httpError(401, 'Phiên đăng nhập không hợp lệ.');
  const userId = new ObjectId(id);
  const user = await repository.findUser(userId);
  if (!user || user.account_status !== 'active') throw httpError(401, 'Tài khoản không hợp lệ hoặc đã bị khóa.');
  const roleIds = [user.primary_role_id, ...(user.additional_role_ids || [])].filter(Boolean);
  const roles = roleIds.length ? await repository.findRoles(roleIds) : [];
  if (!roles.some((role) => ALLOWED_EKYC_ROLES.has(role.code))) throw httpError(403, 'Bạn không có quyền thực hiện xác minh eKYC.');
  return { userId, user };
}
function serialize(user) {
  return {
    identity: { status: user.identity_kyc?.status || 'unverified', documentType: user.identity_kyc?.document_type || null, idMasked: user.identity_kyc?.id_masked || null, submittedAt: user.identity_kyc?.submitted_at || null, verifiedAt: user.identity_kyc?.verified_at || null, reviewNote: user.identity_kyc?.review_note || '' },
    driverLicense: { status: user.driver_license?.verification_status || 'unverified', class: user.driver_license?.class || null, licenseMasked: user.driver_license?.license_masked || null, expiresAt: user.driver_license?.expires_at || null, submittedAt: user.driver_license?.submitted_at || null, reviewNote: user.driver_license?.review_note || '' },
    operatorPrecheck: user.operator_identity_precheck || null,
  };
}

export function createIdentityVerificationService(repository, fileRepository) {
  return {
    async mine(actor) {
      const { user } = await requireEkycUser(repository, actor);
      return serialize(user);
    },
    async submit(body, actor) {
      const { userId, user } = await requireEkycUser(repository, actor);
      if (user.identity_kyc?.status === 'verified' && user.driver_license?.verification_status === 'verified') {
        throw httpError(409, 'Hồ sơ eKYC đã được xác minh. Liên hệ hỗ trợ nếu cần thay đổi giấy tờ.');
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Hồ sơ eKYC không hợp lệ.');
      const identity = body.identity || {};
      const license = body.driverLicense || {};
      const documentType = ['national_id', 'passport'].includes(identity.documentType) ? identity.documentType : null;
      const identityNumber = text(identity.number, 'Số CCCD hoặc hộ chiếu', 6, 32);
      const licenseNumber = text(license.number, 'Số giấy phép lái xe', 6, 32);
      const licenseClass = text(license.class, 'Hạng giấy phép lái xe', 1, 12).toUpperCase();
      const expiresAt = new Date(license.expiresAt);
      if (!documentType || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw httpError(400, 'Loại giấy tờ hoặc hạn giấy phép lái xe không hợp lệ.');
      const identityFile = validFile(identity.file, 'Tài liệu định danh');
      const licenseFile = validFile(license.file, 'Giấy phép lái xe');
      const uploaded = [];
      try {
        const identityKey = await fileRepository.save(userId, identityFile, 'identity_document');
        uploaded.push(identityKey);
        const licenseKey = await fileRepository.save(userId, licenseFile, 'driver_license');
        uploaded.push(licenseKey);
        const now = new Date();
        const result = await repository.updateUser(userId, {
          $set: {
            identity_kyc: { status: 'pending', document_type: documentType, id_masked: mask(identityNumber), evidence_key: identityKey, submitted_at: now, verified_at: null, reviewed_at: null, reviewed_by_user_id: null, review_note: '', provider: 'manual_review' },
            driver_license: { class: licenseClass, license_masked: mask(licenseNumber), expires_at: expiresAt, verification_status: 'pending', evidence_key: licenseKey, submitted_at: now, reviewed_at: null, reviewed_by_user_id: null, review_note: '', provider: 'manual_review' },
            updated_at: now,
          },
          $push: { verification_history: { action: 'submitted', at: now, by_user_id: userId, identity_evidence_key: identityKey, license_evidence_key: licenseKey } },
          $unset: { operator_identity_precheck: 1 },
        });
        if (result.modifiedCount !== 1) throw httpError(409, 'Không thể cập nhật hồ sơ eKYC.');
        await repository.createAudit({ actor_user_id: userId, action: 'identity_verification.submit', entity_type: 'users', entity_id: userId, sanitized_changes: { document_type: documentType, license_class: licenseClass, provider: 'manual_review' }, created_at: now });
        return { status: 'pending', submittedAt: now };
      } catch (error) {
        if (uploaded.length) await fileRepository.remove(uploaded);
        throw error;
      }
    },
    async list(query = {}) {
      const status = statuses.has(query.status) || query.status === 'all' ? query.status : 'pending';
      const users = await repository.findPending(status);
      return { data: users.map((user) => ({ id: user._id.toString(), name: user.full_name, email: user.email, phone: user.phone, ...serialize(user) })) };
    },
    async precheck(id, body, operatorId) {
      if (!ObjectId.isValid(id)) throw httpError(400, 'Mã hồ sơ eKYC không hợp lệ.');
      const action = body?.action;
      const status = { ready: 'ready', needs_revision: 'needs_revision' }[action];
      const note = typeof body?.note === 'string' ? body.note.trim() : '';
      if (!status || note.length > 1000 || (action === 'needs_revision' && note.length < 5)) {
        throw httpError(400, 'Cần chọn kết quả kiểm tra; yêu cầu bổ sung phải có lý do từ 5 đến 1.000 ký tự.');
      }
      const userId = new ObjectId(id);
      const user = await repository.findUser(userId);
      if (!user || user.identity_kyc?.status !== 'pending' || user.driver_license?.verification_status !== 'pending') {
        throw httpError(409, 'Hồ sơ eKYC không còn chờ kiểm tra.');
      }
      if (user.operator_identity_precheck?.status === 'ready') throw httpError(409, 'Hồ sơ eKYC đã được Operator xác nhận đầy đủ.');
      const now = new Date();
      const result = await repository.updateUser(userId, {
        $set: {
          operator_identity_precheck: { status, note, checked_at: now, checked_by_user_id: operatorId },
          updated_at: now,
        },
        $push: { verification_history: { action: `operator_precheck_${action}`, at: now, by_user_id: operatorId, note } },
      });
      if (result.modifiedCount !== 1) throw httpError(409, 'Hồ sơ eKYC vừa được cập nhật. Hãy tải lại danh sách.');
      await repository.createAudit({ actor_user_id: operatorId, action: `identity_verification.operator_precheck_${action}`, entity_type: 'users', entity_id: userId, sanitized_changes: { status, note }, created_at: now });
      return { id, status, checkedAt: now };
    },
    async review(id, body, reviewerId) {
      if (!ObjectId.isValid(id)) throw httpError(400, 'Mã hồ sơ eKYC không hợp lệ.');
      const action = body?.action;
      const next = { approve: 'verified', revision: 'revision_required', reject: 'rejected' }[action];
      const note = typeof body?.note === 'string' ? body.note.trim() : '';
      if (!next || note.length > 1000 || (action !== 'approve' && note.length < 5)) throw httpError(400, action === 'approve' ? 'Thông tin xét duyệt eKYC không hợp lệ.' : 'Yêu cầu bổ sung hoặc từ chối cần có lý do từ 5 đến 1.000 ký tự.');
      const userId = new ObjectId(id);
      const user = await repository.findUser(userId);
      if (!user || user.identity_kyc?.status !== 'pending' || user.driver_license?.verification_status !== 'pending') throw httpError(409, 'Hồ sơ eKYC không còn chờ xét duyệt.');
      if (!user.operator_identity_precheck?.status) throw httpError(409, 'Operator cần kiểm tra hồ sơ trước khi Manager quyết định.');
      if (action === 'approve' && user.operator_identity_precheck.status !== 'ready') throw httpError(409, 'Operator đã yêu cầu bổ sung; cần Operator kiểm tra lại trước khi Manager phê duyệt.');
      const now = new Date();
      const result = await repository.updateUser(userId, {
        $set: {
          'identity_kyc.status': next, 'identity_kyc.verified_at': action === 'approve' ? now : null, 'identity_kyc.reviewed_at': now, 'identity_kyc.reviewed_by_user_id': reviewerId, 'identity_kyc.review_note': note,
          'driver_license.verification_status': next, 'driver_license.reviewed_at': now, 'driver_license.reviewed_by_user_id': reviewerId, 'driver_license.review_note': note,
          updated_at: now,
        },
        $push: { verification_history: { action: `review_${action}`, at: now, by_user_id: reviewerId, note } },
      });
      if (result.modifiedCount !== 1) throw httpError(409, 'Hồ sơ eKYC vừa được cập nhật. Hãy tải lại danh sách.');
      await repository.createAudit({ actor_user_id: reviewerId, action: `identity_verification.${action}`, entity_type: 'users', entity_id: userId, sanitized_changes: { status: next, note }, created_at: now });
      return { id, status: next, reviewedAt: now };
    },
    async download(id, kind) {
      if (!ObjectId.isValid(id) || !['identity', 'license'].includes(kind)) throw httpError(400, 'Tài liệu eKYC không hợp lệ.');
      const user = await repository.findUser(new ObjectId(id));
      const key = kind === 'identity' ? user?.identity_kyc?.evidence_key : user?.driver_license?.evidence_key;
      if (!key) throw httpError(404, 'Không tìm thấy tài liệu eKYC.');
      const bytes = await repository.readFile(key);
      const contentType = key.endsWith('.pdf') ? 'application/pdf' : key.endsWith('.png') ? 'image/png' : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      return { bytes, contentType };
    },
  };
}
