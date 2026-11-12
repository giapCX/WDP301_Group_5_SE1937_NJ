import { Types } from 'mongoose';
import { randomInt, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { BOOKING_REVIEW_WINDOW_MS, bookingHoldExpression, isBookingHoldExpired } from '../utils/booking-hold.js';
import { httpError } from '../utils/http-error.js';
const id = value => {
  if (!/^[a-f\d]{24}$/i.test(String(value))) throw httpError(400, 'Mã định danh không hợp lệ.');
  return new Types.ObjectId(String(value));
};
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const text = (value, min, max, label) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw httpError(400, `${label}: cần từ ${min} đến ${max} ký tự.`);
  return value.trim();
};
const money = value => Number.isSafeInteger(value) && value >= 0;
export function activeReservation(now = new Date()) {
  return {
    $or: [{
      status: {
        $in: ['confirmed', 'ongoing']
      }
    }, {
      status: {
        $in: ['pending', 'awaiting_payment']
      },
      $expr: { $or: [{ $eq: [bookingHoldExpression, null] }, { $gt: [bookingHoldExpression, now] }] }
    }]
  };
}
export function selectPolicies(records, now = new Date()) {
  const selected = {};
  for (const p of records.filter(p => p.status === 'active' && (!p.effective_from || new Date(p.effective_from) <= now) && (!p.effective_until || new Date(p.effective_until) > now)).sort((a, b) => new Date(b.effective_from || 0) - new Date(a.effective_from || 0) || (b.version || 0) - (a.version || 0))) {
    if (!selected[p.policy_type]) selected[p.policy_type] = {
      version: p.version,
      config: p.config
    };
  }
  return selected;
}
export function rentalDates(body, now = new Date()) {
  const start = new Date(body.start_at),
    end = new Date(body.end_at);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || +start < +now + 7200000 || +end - +start < 86400000) throw httpError(400, 'Nhận xe trước ít nhất 2 giờ và thuê tối thiểu 24 giờ.');
  return {
    start,
    end,
    days: Math.ceil((end - start) / 86400000)
  };
}
export function cancellationDecision(booking, policy, now = new Date()) {
  const config = policy?.config;
  if (!config || !Number.isFinite(config.free_cancel_before_hours)) throw httpError(409, 'Chưa có chính sách hủy hiệu lực. Liên hệ vận hành.');
  const eligible = (new Date(booking.start_at) - now) / 3600000 >= config.free_cancel_before_hours;
  return {
    decision: eligible && config.refund_if_eligible === true ? 'eligible_refund' : 'requires_review',
    refund_amount: eligible && config.refund_if_eligible === true ? booking.rental_fee_amount : null,
    policy_version: policy.version
  };
}
export function createRenterService(repo, {
  demo = process.env.RENTER_DEMO_SERVICES === 'true' && process.env.NODE_ENV !== 'production'
} = {}) {
  let ready;
  const ensure = () => ready ||= repo.indexes().catch(error => {
    ready = undefined;
    throw error;
  });
  const policies = async session => selectPolicies(await repo.list('platform_policies', {
    status: 'active'
  }, {
    session,
    limit: 1000
  }));
  const audit = (user, action, entity, entityId, session) => repo.insert('audit_logs', {
    _id: new Types.ObjectId(),
    actor_user_id: user._id,
    action,
    entity_type: entity,
    entity_id: entityId,
    created_at: new Date()
  }, session);
  async function owned(user, bookingId, session) {
    const b = await repo.one('bookings', {
      _id: id(bookingId),
      renter_id: user._id
    }, session);
    if (!b) throw httpError(404, 'Không tìm thấy chuyến đi của bạn.');
    return b;
  }
  const held = b => {
    if (b.status !== 'awaiting_payment' || isBookingHoldExpired(b)) throw httpError(409, 'Đơn chưa được duyệt, hết thời gian giữ xe hoặc không còn chờ thanh toán.');
  };
  async function files(user, values, purpose, session) {
    if (!Array.isArray(values)) throw httpError(400, 'Thiếu tệp đính kèm.');
    const docs = [];
    for (const value of values) {
      const doc = await repo.one('renter_files', {
        _id: id(value),
        owner_id: user._id,
        purpose
      }, session);
      if (!doc) throw httpError(400, 'Tệp không tồn tại hoặc không thuộc tài khoản.');
      docs.push(doc);
    }
    return docs;
  }
  async function challengeCheck(user, body, purpose, target) {
    const query = {
      _id: id(body.challenge_id),
      actor: String(user?._id || 'guest'),
      purpose,
      target,
      used: false
    };
    const challenge = await repo.one('renter_challenges', query);
    if (!challenge || challenge.expires_at <= new Date() || challenge.attempts >= 5) throw httpError(400, 'OTP hết hạn, bị khóa hoặc không đúng yêu cầu.');
    if (!/^\d{6}$/.test(String(body.otp)) || hash(`${challenge._id}:${body.otp}`) !== challenge.code_hash) {
      await repo.update('renter_challenges', query, {
        $inc: {
          attempts: 1
        }
      });
      throw httpError(400, 'Mã OTP không đúng.');
    }
    return async session => {
      const result = await repo.update('renter_challenges', {
        ...query,
        expires_at: {
          $gt: new Date()
        },
        attempts: {
          $lt: 5
        }
      }, {
        $set: {
          used: true
        }
      }, session);
      if (result.modifiedCount !== 1) throw httpError(409, 'OTP đã dùng hoặc hết hạn.');
    };
  }
  function contacts(body) {
    const email = text(body.email, 5, 254, 'Email').toLowerCase();
    const phone = text(body.phone, 10, 10, 'Số điện thoại');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^0[35789]\d{8}$/.test(phone)) throw httpError(400, 'Email hoặc số điện thoại Việt Nam không hợp lệ.');
    return {
      email,
      phone
    };
  }
  const contactTarget = body => hash(JSON.stringify(contacts(body)));
  const safeProfile = user => {
    const {
      password_hash,
      payout_profile,
      ...publicUser
    } = user;
    return {
      ...publicUser,
      payout_profile: payout_profile ? {
        bank_name: payout_profile.bank_name,
        account_masked: payout_profile.account_masked
      } : null
    };
  };
  return {
    async config() {
      return {
        policies: await policies(),
        services: {
          otp: demo ? 'demo' : 'unconfigured',
          ekyc: demo ? 'demo' : 'unconfigured',
          payment: demo ? 'demo' : 'unconfigured'
        }
      };
    },
    async challenge(user, body) {
      await ensure();
      if (!demo) throw httpError(503, 'Chưa cấu hình gửi OTP. Không có mã xác thực được gửi.');
      const purpose = body.purpose;
      if (!['register', 'profile', 'sign'].includes(purpose) || (!user && purpose !== 'register')) throw httpError(400, 'Mục đích OTP không hợp lệ.');
      let target;
      if (purpose === 'sign') { const booking = await owned(user, body.booking_id); held(booking); target = String(booking._id); }
      else target = contactTarget(body);
      const recent = await repo.one('renter_challenges', { actor: String(user?._id || 'guest'), purpose, target, created_at: { $gt: new Date(Date.now() - 60000) } });
      if (recent) throw httpError(429, 'Vui lòng chờ 60 giây trước khi gửi lại OTP.');
      const _id = new Types.ObjectId(), code = String(randomInt(0,1000000)).padStart(6,'0');
      const expires_at = new Date(Date.now() + (purpose === 'sign' ? 180 : 120) * 1000);
      await repo.insert('renter_challenges', { _id, actor: String(user?._id || 'guest'), purpose, target, code_hash: hash(`${_id}:${code}`), attempts: 0, used: false, created_at: new Date(), expires_at });
      return { challenge_id: _id, expires_at, demo: true, demo_code: code };
    },
    async register(body) {
      await ensure();
      const c = contacts(body),
        full_name = text(body.full_name, 2, 100, 'Họ tên');
      if (!/^[\p{L}\s]+$/u.test(full_name)) throw httpError(400, 'Họ tên chỉ chứa chữ và khoảng trắng.');
      if (typeof body.password !== 'string' || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,32}$/.test(body.password) || body.password !== body.confirm_password || body.agree_terms !== true) throw httpError(400, 'Mật khẩu 8–32 ký tự gồm hoa, thường, số, ký tự đặc biệt; xác nhận mật khẩu và đồng ý điều khoản.');
      const consume = await challengeCheck(null, body, 'register', contactTarget(c));
      const password_hash = await bcrypt.hash(body.password, 12);
      return repo.transaction(async session => {
        await consume(session);
        if (await repo.one('users', {
          $or: [{
            email: c.email
          }, {
            phone: c.phone
          }]
        }, session)) throw httpError(409, 'Email hoặc điện thoại đã đăng ký.');
        for (const value of [c.email, c.phone]) await repo.insert('renter_contact_keys', {
          _id: value
        }, session);
        const role = await repo.one('roles', {
          code: 'RENTER'
        }, session);
        if (!role) throw httpError(409, 'Chưa cấu hình vai trò RENTER.');
        const user = await repo.insert('users', {
          _id: new Types.ObjectId(),
          ...c,
          full_name,
          password_hash,
          primary_role_id: role._id,
          additional_role_ids: [],
          account_status: 'active',
          identity_kyc: {
            status: 'unverified'
          },
          driver_license: {
            verification_status: 'unverified'
          },
          created_at: new Date(),
          updated_at: new Date()
        }, session);
        await audit(user, 'renter.register', 'user', user._id, session);
        return safeProfile(user);
      });
    },
    async profile(user) {
      return safeProfile(await repo.one('users', {
        _id: user._id
      }));
    },
    async updateProfile(user, body) {
      const c = contacts(body),
        full_name = text(body.full_name, 2, 100, 'Họ tên');
      const address = body.address ? text(body.address, 5, 255, 'Địa chỉ') : '';
      const city = body.city ? text(body.city, 1, 100, 'Thành phố') : '';
      const changed = c.email !== user.email || c.phone !== user.phone;
      const consume = changed ? await challengeCheck(user, body, 'profile', contactTarget(c)) : null;
      if (body.avatar_key) await files(user, [body.avatar_key], 'avatar');
      await repo.transaction(async session => {
        await repo.update('users', {
          _id: user._id
        }, {
          $set: {
            updated_at: new Date()
          }
        }, session);
        if (consume) await consume(session);
        if (await repo.one('users', {
          _id: {
            $ne: user._id
          },
          $or: [{
            email: c.email
          }, {
            phone: c.phone
          }]
        }, session)) throw httpError(409, 'Email hoặc điện thoại đã được sử dụng.');
        if (changed) for (const value of [c.email, c.phone].filter(value => ![user.email, user.phone].includes(value))) await repo.insert('renter_contact_keys', {
          _id: value
        }, session);
        await repo.update('users', {
          _id: user._id
        }, {
          $set: {
            ...c,
            full_name,
            contact_profile: {
              ...user.contact_profile,
              address,
              city,
              ...(body.avatar_key ? {
                avatar_key: body.avatar_key
              } : {})
            },
            updated_at: new Date()
          }
        }, session);
        await audit(user, 'renter.profile.update', 'user', user._id, session);
      });
      return this.profile(user);
    },
    async password(user, body) {
      if (!user.password_hash || !(await bcrypt.compare(String(body.current_password || ''), user.password_hash))) throw httpError(400, 'Mật khẩu hiện tại không đúng.');
      if (typeof body.new_password !== 'string' || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,32}$/.test(body.new_password) || body.new_password !== body.confirm_password || (await bcrypt.compare(body.new_password, user.password_hash))) throw httpError(400, 'Mật khẩu mới không hợp lệ hoặc trùng mật khẩu cũ.');
      await repo.update('users', {
        _id: user._id,
        password_hash: user.password_hash
      }, {
        $set: {
          password_hash: await bcrypt.hash(body.new_password, 12),
          updated_at: new Date()
        }
      });
      return {
        message: 'Đã cập nhật mật khẩu.'
      };
    },
    async upload(user, body) {
      await ensure();
      if (!['avatar', 'identity', 'incident'].includes(body.purpose) || !['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(body.content_type)) throw httpError(400, 'Loại tệp không hỗ trợ.');
      if (body.purpose !== 'incident' && body.content_type === 'video/mp4') throw httpError(400, 'Giấy tờ/ảnh đại diện phải là ảnh.');
      if (body.purpose === 'identity' && body.content_type === 'image/webp') throw httpError(400, 'Giấy tờ cần JPEG hoặc PNG.');
      if (typeof body.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)) throw httpError(400, 'Dữ liệu tệp không hợp lệ.');
      const bytes = Buffer.from(body.data, 'base64');
      const max = body.purpose === 'avatar' ? 5 : body.purpose === 'identity' ? 10 : 20;
      if (!bytes.length || bytes.length > max * 1024 * 1024 || body.purpose === 'identity' && bytes.length < 100 * 1024) throw httpError(400, `Tệp vượt giới hạn ${max} MB hoặc ảnh giấy tờ nhỏ hơn 100 KB.`);
      const valid = body.content_type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : body.content_type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : body.content_type === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' : bytes.toString('ascii', 4, 8) === 'ftyp';
      if (!valid) throw httpError(400, 'Nội dung tệp không khớp loại khai báo.');
      const doc = {
        _id: new Types.ObjectId(),
        owner_id: user._id,
        purpose: body.purpose,
        content_type: body.content_type,
        size: bytes.length,
        name: text(body.name, 1, 180, 'Tên tệp'),
        created_at: new Date()
      };
      await repo.transaction(async session => {
        await repo.insert('renter_files', doc, session);
        for (let offset = 0, n = 0; offset < bytes.length; offset += 4 * 1024 * 1024, n++) await repo.insert('renter_file_chunks', {
          _id: new Types.ObjectId(),
          file_id: doc._id,
          n,
          data: bytes.subarray(offset, offset + 4 * 1024 * 1024)
        }, session);
      });
      return doc;
    },
    async download(user, fileId) {
      const doc = await repo.one('renter_files', {
        _id: id(fileId),
        owner_id: user._id
      });
      if (!doc) throw httpError(404, 'Không tìm thấy tệp.');
      const chunks = await repo.list('renter_file_chunks', {
        file_id: doc._id
      }, {
        sort: {
          n: 1
        },
        limit: 10
      });
      return {
        doc,
        bytes: Buffer.concat(chunks.map(c => Buffer.isBuffer(c.data) ? c.data : Buffer.from(c.data.buffer)))
      };
    },
    async ekyc(user, body) {
      if (user.identity_kyc?.status === 'verified' && user.driver_license?.verification_status === 'verified') throw httpError(409, 'Hồ sơ đã xác minh. Liên hệ hỗ trợ để thay đổi.');
      if (!['Citizen_ID', 'Passport'].includes(body.document_type) || !(body.document_type === 'Citizen_ID' ? /^\d{12}$/ : /^[A-Za-z0-9]{8,9}$/).test(String(body.document_number)) || !/^\d{12}$/.test(String(body.license_number)) || !['B1', 'B2', 'C', 'D', 'E'].includes(body.license_class)) throw httpError(400, 'CCCD/Passport hoặc GPLX không đúng định dạng.');
      const expires = new Date(body.expires_at);
      if (!Number.isFinite(+expires) || expires <= new Date()) throw httpError(400, 'GPLX phải còn hạn.');
      const keys = [body.id_front, ...(body.document_type === 'Citizen_ID' ? [body.id_back] : []), body.license_front, body.license_back];
      if (new Set(keys).size !== keys.length) throw httpError(400, 'Mỗi mặt giấy tờ cần một ảnh riêng.');
      await files(user, keys, 'identity');
      const status = demo ? 'verified' : 'pending';
      await repo.transaction(async session => {
        await repo.update('users', {
          _id: user._id
        }, {
          $set: {
            identity_kyc: {
              status,
              id_masked: '********' + String(body.document_number).slice(-4),
              document_type: body.document_type,
              evidence_keys: keys.slice(0, body.document_type === 'Citizen_ID' ? 2 : 1),
              verification_environment: demo ? 'demo' : 'pending_provider',
              ...(demo ? {
                verified_at: new Date()
              } : {})
            },
            driver_license: {
              class: body.license_class,
              license_masked: '********' + String(body.license_number).slice(-4),
              expires_at: expires,
              verification_status: status,
              evidence_keys: [body.license_front, body.license_back]
            },
            updated_at: new Date()
          }
        }, session);
        await audit(user, 'renter.kyc.submit', 'user', user._id, session);
      });
      return {
        status,
        demo,
        message: demo ? 'Xác minh mô phỏng, chỉ dùng dữ liệu thử nghiệm.' : 'Đã nhận hồ sơ. Chờ dịch vụ xác minh hoặc người có thẩm quyền xử lý.'
      };
    },
    async createBooking(user, body) {
      await ensure();
      const dates = rentalDates(body),
        listingId = id(body.listing_id);
      const request_key = text(body.request_key, 8, 100, 'Mã yêu cầu');
      if (body.agreed !== true) throw httpError(400, 'Cần đồng ý điều khoản thuê.');
      if (user.identity_kyc?.verification_environment === 'demo' && !demo || user.identity_kyc?.status !== 'verified' || user.driver_license?.verification_status !== 'verified' || !(new Date(user.driver_license.expires_at) >= dates.end) || !user.contact_profile?.address) throw httpError(409, 'Cần xác minh CCCD/GPLX còn hạn hết chuyến và bổ sung địa chỉ trong hồ sơ.');
      return repo.transaction(async session => {
        const replay = await repo.one('bookings', {
          renter_id: user._id,
          request_key
        }, session);
        if (replay) {
          if (String(replay.listing_id) !== String(listingId) || +replay.start_at !== +dates.start || +replay.end_at !== +dates.end) throw httpError(409, 'Mã yêu cầu đã dùng cho nội dung đặt xe khác.');
          return {
            booking: replay,
            replayed: true
          };
        }
        const listing = await repo.one('vehicle_listings', {
          _id: listingId,
          status: 'published'
        }, session);
        if (!listing) throw httpError(404, 'Tin xe không còn được đăng.');
        // Serializing writes per vehicle prevents simultaneous overlapping reservations.
        const lock = await repo.update('vehicles', {
          _id: listing.vehicle_id,
          onboarding_status: 'approved',
          physical_status: {
            $in: ['at_garage', 'rented']
          }
        }, {
          $inc: {
            renter_calendar_version: 1
          }
        }, session);
        if (lock.matchedCount !== 1) throw httpError(409, 'Xe không sẵn sàng cho thuê.');
        const vehicle = await repo.one('vehicles', {
          _id: listing.vehicle_id
        }, session);
        if (String(vehicle.owner_id) === String(user._id)) throw httpError(409, 'Không thể tự thuê xe của mình.');
        if ((listing.availability_blocks || []).some(b => b.start_at < dates.end && b.end_at > dates.start)) throw httpError(409, 'Xe bị khóa lịch trong thời gian này.');
        if (await repo.one('bookings', {
          vehicle_id: vehicle._id,
          start_at: {
            $lt: dates.end
          },
          end_at: {
            $gt: dates.start
          },
          ...activeReservation()
        }, session)) throw httpError(409, 'Xe đã có đơn thuê hoặc đang được giữ trong khoảng này.');
        const management = await repo.one('management_agreements', {
          vehicle_id: vehicle._id,
          status: 'active',
          start_date: {
            $lte: dates.start
          },
          end_date: {
            $gte: dates.end
          }
        }, session);
        if (!management || !management.signature_info?.owner_signed_at || !management.signature_info?.platform_signed_at || !management.authorization_scope?.rental_contract_signing) throw httpError(409, 'Chưa có hợp đồng quản lý xe hợp lệ cho toàn chuyến.');
        if (!money(listing.daily_price) || listing.daily_price <= 0 || !money(listing.security_deposit_amount)) throw httpError(409, 'Giá thuê hoặc tiền cọc chưa được cấu hình.');
        const policy_snapshot = await policies(session),
          now = new Date(),
          _id = new Types.ObjectId();
        const rental = listing.daily_price * dates.days;
        if (!money(rental)) throw httpError(400, 'Tổng tiền không hợp lệ.');
        const booking = {
          _id,
          booking_code: `BK-${_id}`,
          renter_id: user._id,
          vehicle_id: vehicle._id,
          listing_id: listingId,
          management_agreement_id: management._id,
          start_at: dates.start,
          end_at: dates.end,
          pickup_location: {
            branch: listing.pickup_location?.branch_name || listing.pickup_location?.address_label
          },
          return_location: {
            branch: listing.pickup_location?.branch_name || listing.pickup_location?.address_label
          },
          rental_fee_amount: rental,
          deposit_amount_snapshot: listing.security_deposit_amount,
          pricing_snapshot: {
            daily_price: listing.daily_price,
            charged_days: dates.days,
            currency: 'VND',
            commission_rate_pct: management.commission_rate_pct,
            late_fee_per_hour: listing.rental_policy_snapshot?.late_fee_per_hour
          },
          policy_snapshot,
          hold_expires_at: new Date(+now + BOOKING_REVIEW_WINDOW_MS),
          review_info: {
            required: true,
            decision: 'pending'
          },
          status: 'pending',
          request_key,
          created_at: now,
          updated_at: now,
          status_history: [{
            from: 'created',
            to: 'pending',
            at: now,
            actor: String(user._id)
          }]
        };
        const agreement = {
          _id: new Types.ObjectId(),
          booking_id: _id,
          management_agreement_id: management._id,
          contract_number: `RENT-${_id}`,
          lender_details_snapshot: {
            owner_id: vehicle.owner_id,
            authority_agreement_number: management.agreement_number
          },
          renter_details_snapshot: {
            renter_id: user._id,
            verified_license: true,
            full_name: user.full_name
          },
          terms_snapshot: {
            daily_rate: listing.daily_price,
            rental_fee_amount: rental,
            deposit_amount: listing.security_deposit_amount,
            start_at: dates.start,
            end_at: dates.end,
            signature_method: 'electronic_acceptance',
            mileage_policy: listing.mileage_policy,
            rental_policy: listing.rental_policy_snapshot,
            cancellation: policy_snapshot.cancellation,
            deposit_refund: policy_snapshot.deposit_refund
          },
          signing_info: {
            method: 'electronic_acceptance',
            renter_confirmed: false
          },
          status: 'pending_signature',
          created_at: now
        };
        await repo.insert('bookings', booking, session);
        await repo.insert('rental_agreements', agreement, session);
        await audit(user, 'renter.booking.create', 'booking', _id, session);
        return {
          booking,
          agreement
        };
      });
    },
    async bookings(user, query = {}) {
      const page = Math.max(1, Math.min(100000, parseInt(query.page, 10) || 1)),
        limit = 10;
      const status = query.status || 'all',
        q = query.q || '';
      if (typeof status !== 'string' || !['all', 'active', 'pending', 'awaiting_payment', 'confirmed', 'ongoing', 'completed', 'cancelled', 'expired', 'rejected'].includes(status) || typeof q !== 'string' || q.length > 50) throw httpError(400, 'Bộ lọc chuyến đi không hợp lệ.');
      const regex = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pipeline = [{
        $match: {
          renter_id: user._id
        }
      }, {
        $set: {
          status: {
            $cond: [{
              $and: [{
                $in: ['$status', ['pending', 'awaiting_payment']]
              }, {
                $ne: [{
                  $ifNull: [bookingHoldExpression, null]
                }, null]
              }, {
                $lte: [bookingHoldExpression, new Date()]
              }]
            }, 'expired', '$status']
          }
        }
      }, {
        $lookup: {
          from: 'vehicles',
          localField: 'vehicle_id',
          foreignField: '_id',
          as: 'vehicle',
          pipeline: [{
            $project: {
              brand: 1,
              model: 1,
              license_plate: 1
            }
          }]
        }
      }, {
        $set: {
          vehicle: {
            $arrayElemAt: ['$vehicle', 0]
          }
        }
      }];
      if (status !== 'all') pipeline.push({
        $match: {
          status: status === 'active' ? {
            $in: ['confirmed', 'ongoing']
          } : status
        }
      });
      if (q) pipeline.push({
        $match: {
          $or: [{
            booking_code: {
              $regex: regex,
              $options: 'i'
            }
          }, {
            'vehicle.license_plate': {
              $regex: regex,
              $options: 'i'
            }
          }]
        }
      });
      pipeline.push({
        $facet: {
          data: [{
            $sort: {
              created_at: -1,
              _id: -1
            }
          }, {
            $skip: (page - 1) * limit
          }, {
            $limit: limit
          }],
          count: [{
            $count: 'total'
          }]
        }
      });
      const [result] = await repo.aggregate('bookings', pipeline),
        total = result.count[0]?.total || 0;
      return {
        data: result.data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    },
    async detail(user, bookingId) {
      const booking = await owned(user, bookingId);
      if (['pending', 'awaiting_payment'].includes(booking.status) && isBookingHoldExpired(booking)) booking.status = 'expired';
      const [agreement, payments, deposit, vehicle, pickup, returned] = await Promise.all([repo.one('rental_agreements', {
        booking_id: booking._id
      }), repo.list('payment_transactions', {
        booking_id: booking._id
      }, {
        limit: 200
      }), repo.one('security_deposits', {
        booking_id: booking._id
      }), repo.one('vehicles', {
        _id: booking.vehicle_id
      }), repo.one('rental_handovers', {
        booking_id: booking._id,
        handover_type: 'pickup',
        status: 'confirmed'
      }), repo.one('rental_handovers', { booking_id: booking._id, handover_type: 'return', status: 'confirmed' })]);
      const receipt = (row) => row ? {
        occurred_at: row.occurred_at, odometer_km: row.odometer_km, fuel_level_pct: row.fuel_level_pct,
        renter_response: row.renter_response, condition: Object.fromEntries(
          ['exterior', 'interior', 'engine', 'tires', 'note'].map((key) => [key, row.vehicle_condition?.[key]]),
        ),
      } : null;
      return {
        booking,
        agreement,
        payments,
        deposit,
        vehicle: vehicle ? {
          brand: vehicle.brand,
          model: vehicle.model,
          license_plate: vehicle.license_plate
        } : null,
        handovers: { pickup: receipt(pickup), return: receipt(returned) },
        pickup_odometer_km: pickup?.odometer_km
      };
    },
    async voucher(user, bookingId, body) {
      return repo.transaction(async session => {
        const booking = await owned(user, bookingId, session);
        held(booking);
        if (booking.discount_code) throw httpError(409, 'Đơn đã áp dụng một mã giảm giá.');
        const agreement = await repo.one('rental_agreements', {
          booking_id: booking._id
        }, session);
        if (agreement?.status === 'signed' || agreement?.contract_document) throw httpError(409, 'Không thay đổi giá sau khi lập nội dung trình ký.');
        const code = text(body.code, 1, 50, 'Mã ưu đãi').toUpperCase();
        const discount = await repo.one('discount_codes', {
          code,
          is_active: true
        }, session);
        if (!discount || !discount.expiry_date || new Date(discount.expiry_date) <= new Date() || discount.starts_at && new Date(discount.starts_at) > new Date() || booking.rental_fee_amount < (discount.min_order_value || 0) || discount.usage_limit != null && (discount.used_count || 0) >= discount.usage_limit) throw httpError(400, 'Mã ưu đãi hết hạn hoặc không đủ điều kiện.');
        const amount = discount.discount_type === 'percentage' ? Math.floor(booking.rental_fee_amount * discount.discount_value / 100) : discount.discount_type === 'fixed' ? discount.discount_value : NaN;
        if (!money(amount) || amount <= 0 || amount >= booking.rental_fee_amount) throw httpError(400, 'Mức giảm giá chưa hợp lệ.');
        const used = await repo.update('discount_codes', {
          _id: discount._id,
          ...(discount.usage_limit != null ? {
            $expr: {
              $lt: [{
                $ifNull: ['$used_count', 0]
              }, discount.usage_limit]
            }
          } : {})
        }, {
          $inc: {
            used_count: 1
          }
        }, session);
        if (used.modifiedCount !== 1) throw httpError(409, 'Mã ưu đãi vừa hết lượt.');
        const value = booking.rental_fee_amount - amount;
        await repo.update('bookings', {
          _id: booking._id
        }, {
          $set: {
            discount_code: code,
            discount_amount: amount,
            rental_fee_amount: value,
            updated_at: new Date()
          }
        }, session);
        await repo.update('rental_agreements', {
          booking_id: booking._id
        }, {
          $set: {
            'terms_snapshot.rental_fee_amount': value,
            'terms_snapshot.discount_code': code,
            'terms_snapshot.discount_amount': amount
          }
        }, session);
        return {
          rental_fee_amount: value,
          discount_amount: amount
        };
      });
    },
    async sign(user, bookingId, body) {
      if (body.agreed !== true || body.read_to_end !== true) throw httpError(400, 'Cần đọc hết và đồng ý hợp đồng.');
      const booking = await owned(user, bookingId);
      held(booking);
      const consume = await challengeCheck(user, body, 'sign', String(booking._id));
      return repo.transaction(async session => {
        const b = await owned(user, bookingId, session);
        held(b);
        await repo.update('bookings', {
          _id: b._id
        }, {
          $set: {
            updated_at: new Date()
          }
        }, session);
        const agreement = await repo.one('rental_agreements', {
          booking_id: b._id
        }, session);
        if (!agreement) throw httpError(409, 'Chưa có hợp đồng thuê.');
        if (agreement.status === 'signed') return agreement;
        if (agreement.contract_document || agreement.terms_snapshot?.signature_method === 'electronic_acceptance')
          throw httpError(409, 'Mở hồ sơ hợp đồng để khách thuê và Manager ký riêng.');
        await consume(session);
        const management = await repo.one('management_agreements', {
          _id: b.management_agreement_id
        }, session);
        const signer = management?.platform_signer_id;
        if (!signer) throw httpError(409, 'Chưa có đại diện nền tảng ký hợp đồng.');
        await repo.update('rental_agreements', {
          _id: agreement._id
        }, {
          $set: {
            status: 'signed',
            signed_at: new Date(),
            'signing_info.renter_confirmed': true,
            'signing_info.platform_signer_user_id': signer,
            'signing_info.method': demo ? 'demo_otp' : 'otp'
          }
        }, session);
        await audit(user, 'renter.agreement.sign', 'rental_agreement', agreement._id, session);
        return {
          ...agreement,
          status: 'signed'
        };
      });
    },
    async pay(user, bookingId, body) {
      if (!demo) throw httpError(503, 'Chưa cấu hình cổng thanh toán. Tiền chưa được thu hoặc phong tỏa.');
      if (body.agree_deposit !== true || !['VNPAY_QR', 'DOMESTIC_ATM', 'INTERNATIONAL_CARD', 'MOMO_WALLET'].includes(body.payment_method)) throw httpError(400, 'Chọn phương thức và đồng ý giữ cọc.');
      return repo.transaction(async session => {
        const b = await owned(user, bookingId, session);
        if (b.status === 'confirmed' && (await repo.one('payment_transactions', {
          idempotency_key: `renter:${b._id}:rental`
        }, session))) return {
          demo: true,
          status: 'confirmed',
          replayed: true
        };
        held(b);
        const a = await repo.one('rental_agreements', {
          booking_id: b._id,
          status: 'signed'
        }, session);
        if (!a?.signed_at || !a.signing_info?.renter_confirmed || !a.signing_info.platform_signer_user_id)
          throw httpError(409, 'Hợp đồng cần đủ xác nhận của khách thuê và XeDi trước khi thanh toán.');
        const now = new Date();
        const confirmed = await repo.update('bookings', {
          _id: b._id,
          status: 'awaiting_payment'
        }, {
          $set: {
            status: 'confirmed',
            updated_at: now
          },
          $push: {
            status_history: {
              from: 'awaiting_payment',
              to: 'confirmed',
              at: now,
              actor: String(user._id)
            }
          }
        }, session);
        if (confirmed.modifiedCount !== 1) throw httpError(409, 'Booking đã thay đổi trước khi thanh toán.');
        const rental = {
          _id: new Types.ObjectId(),
          booking_id: b._id,
          initiator_user_id: user._id,
          transaction_type: 'rental_payment',
          direction: 'in',
          amount: b.rental_fee_amount,
          currency: 'VND',
          payment_method: body.payment_method,
          provider: 'DEMO_ONLY',
          idempotency_key: `renter:${b._id}:rental`,
          status: 'succeeded',
          paid_at: now,
          created_at: now
        };
        const deposit = {
          ...rental,
          _id: new Types.ObjectId(),
          transaction_type: 'deposit_collection',
          amount: b.deposit_amount_snapshot,
          idempotency_key: `renter:${b._id}:deposit`
        };
        await repo.insert('payment_transactions', rental, session);
        await repo.insert('payment_transactions', deposit, session);
        await repo.insert('security_deposits', {
          _id: new Types.ObjectId(),
          booking_id: b._id,
          collection_payment_id: deposit._id,
          required_amount: b.deposit_amount_snapshot,
          collected_amount: b.deposit_amount_snapshot,
          deducted_amount: 0,
          refunded_amount: 0,
          refundable_amount: b.deposit_amount_snapshot,
          status: 'collected',
          updated_at: now
        }, session);
        await audit(user, 'renter.payment.demo', 'booking', b._id, session);
        return {
          demo: true,
          status: 'confirmed'
        };
      });
    },
    async cancelPreview(user, bookingId) {
      const b = await owned(user, bookingId),
        p = b.policy_snapshot?.cancellation || (await policies()).cancellation;
      return cancellationDecision(b, p);
    },
    async cancel(user, bookingId, body) {
      const reasons = ['CHANGE_OF_PLAN', 'FOUND_ALTERNATIVE', 'EMERGENCY_ISSUE', 'WEATHER_REASON', 'OTHER'];
      if (!reasons.includes(body.reason) || body.agreed !== true) throw httpError(400, 'Cần chọn lý do và xác nhận chính sách hoàn tiền.');
      const note = body.reason === 'OTHER' ? text(body.note, 10, 500, 'Lý do chi tiết') : body.note ? text(body.note, 1, 500, 'Ghi chú') : '';
      return repo.transaction(async session => {
        const b = await owned(user, bookingId, session);
        if (b.status === 'cancelled') return b;
        if (b.status !== 'confirmed' || b.actual_start_at || (await repo.one('rental_handovers', {
          booking_id: b._id,
          handover_type: 'pickup',
          status: 'confirmed'
        }, session))) throw httpError(409, 'Chỉ hủy chuyến đã xác nhận và chưa bàn giao.');
        const p = b.policy_snapshot?.cancellation || (await policies(session)).cancellation;
        const decision = cancellationDecision(b, p),
          now = new Date();
        const cancellation_info = {
          cancelled_by: user._id,
          cancelled_at: now,
          reason: body.reason,
          note,
          refund_decision: decision.decision,
          refund_amount: decision.refund_amount,
          refund_status: decision.decision === 'eligible_refund' ? 'requested' : 'requires_review',
          policy_version: p.version
        };
        await repo.update('bookings', {
          _id: b._id,
          status: 'confirmed'
        }, {
          $set: {
            status: 'cancelled',
            cancellation_info,
            updated_at: now
          },
          $push: {
            status_history: {
              from: 'confirmed',
              to: 'cancelled',
              at: now,
              actor: String(user._id)
            }
          }
        }, session);
        await repo.insert('notifications', {
          _id: new Types.ObjectId(),
          recipient_user_id: user._id,
          notification_type: 'cancellation',
          title: 'Đã hủy chuyến',
          content: decision.decision === 'eligible_refund' ? 'Yêu cầu hoàn tiền đã được ghi nhận, chưa xác nhận tiền về tài khoản.' : 'Chính sách chưa quy định mức hoàn trường hợp này; chờ vận hành đối soát.',
          related_entity_id: b._id,
          is_read: false,
          created_at: now
        }, session);
        await audit(user, 'renter.booking.cancel', 'booking', b._id, session);
        return {
          ...b,
          status: 'cancelled',
          cancellation_info
        };
      });
    },
    async incidents(user) {
      return repo.list('incident_cases', {
        reported_by_user_id: user._id
      }, {
        limit: 100
      });
    },
    async report(user, body) {
      const description = text(body.description, 20, 1000, 'Mô tả sự cố');
      if (!['TRAFFIC_ACCIDENT', 'MECHANICAL_BREAKDOWN', 'TIRE_PUNCTURE', 'TRAFFIC_CITATION'].includes(body.case_type) || !Number.isFinite(body.latitude) || Math.abs(body.latitude) > 90 || !Number.isFinite(body.longitude) || Math.abs(body.longitude) > 180 || !Number.isSafeInteger(body.odometer_km) || body.odometer_km < 0 || !Array.isArray(body.evidence) || body.evidence.length < 2 || body.evidence.length > 10 || new Set(body.evidence).size !== body.evidence.length) throw httpError(400, 'Cần loại sự cố, GPS hợp lệ, ODO và 2–10 tệp riêng biệt.');
      return repo.transaction(async session => {
        const b = await owned(user, body.booking_id, session);
        if (b.status !== 'ongoing') throw httpError(409, 'Chỉ báo cáo sự cố cho chuyến đang thuê.');
        await repo.update('bookings', {
          _id: b._id,
          status: 'ongoing'
        }, {
          $set: {
            updated_at: new Date()
          }
        }, session);
        const pickup = await repo.one('rental_handovers', {
          booking_id: b._id,
          handover_type: 'pickup',
          status: 'confirmed'
        }, session);
        if (!pickup || body.odometer_km < pickup.odometer_km) throw httpError(400, 'ODO không được nhỏ hơn lúc bàn giao xe.');
        const evidence = await files(user, body.evidence, 'incident', session);
        if (evidence.filter(e => e.content_type.startsWith('image/')).length < 2) throw httpError(400, 'Cần ít nhất hai ảnh toàn cảnh và cận cảnh.');
        const _id = new Types.ObjectId(),
          now = new Date();
        const doc = {
          _id,
          case_number: `SC-${_id}`,
          booking_id: b._id,
          vehicle_id: b.vehicle_id,
          reported_by_user_id: user._id,
          case_type: {
            TRAFFIC_ACCIDENT: 'accident',
            MECHANICAL_BREAKDOWN: 'breakdown',
            TIRE_PUNCTURE: 'breakdown',
            TRAFFIC_CITATION: 'traffic_violation'
          }[body.case_type],
          incident_type: body.case_type,
          description,
          location: {
            latitude: body.latitude,
            longitude: body.longitude
          },
          odometer_km: body.odometer_km,
          evidence: evidence.map(e => ({
            kind: e.content_type.startsWith('image/') ? 'image' : 'video',
            file_key: String(e._id),
            uploaded_by_user_id: user._id
          })),
          investigation: {
            review_status: 'pending'
          },
          status: 'reported',
          created_at: now,
          updated_at: now
        };
        await repo.insert('incident_cases', doc, session);
        const role = (await repo.one('roles', {
          code: 'OPERATIONS'
        }, session)) || (await repo.one('roles', {
          code: 'OPERATION_STAFF'
        }, session));
        if (role) for (const staff of await repo.list('users', {
          account_status: 'active',
          $or: [{
            primary_role_id: role._id
          }, {
            additional_role_ids: role._id
          }]
        }, {
          session,
          limit: 100
        })) await repo.insert('notifications', {
          _id: new Types.ObjectId(),
          recipient_user_id: staff._id,
          notification_type: 'incident_reported',
          title: 'Sự cố trong chuyến thuê',
          content: doc.case_number,
          related_entity_type: 'incident_case',
          related_entity_id: _id,
          is_read: false,
          created_at: now
        }, session);
        await audit(user, 'renter.incident.report', 'incident_case', _id, session);
        return doc;
      });
    }
  };
}
