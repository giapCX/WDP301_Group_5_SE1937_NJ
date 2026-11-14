import { vehicleDocumentContentType } from '../utils/image-content.js';
import { findPageRows } from "../utils/pagination.js";
import { escapeRegExp } from '../utils/regex.js';
import { garageTransaction } from '../utils/garage-transaction.js';
import { BOOKING_PAYMENT_WINDOW_MS, BOOKING_REVIEW_WINDOW_MS, bookingHoldExpression, isBookingHoldExpired } from '../utils/booking-hold.js';
import { createManagerGarageService } from './manager-garage.service.js';
import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';
import { parseManagerBookingDecision, parseManagerListingReview, parseManagerListingUpdate } from '../validators/manager.validator.js';
const {
  ObjectId
} = Types;
import bcrypt from "bcryptjs";
const STAFF_ROLES = ["MANAGER", "OPERATION_STAFF", "GARAGE_STAFF", "ADMIN"];
const MANAGED_STAFF_ROLES = ["OPERATION_STAFF", "GARAGE_STAFF"];
const OPEN_INCIDENT_STATUSES = ["reported", "open", "investigating", "pending_review", "awaiting_response", "pending_manager", "need_more_information", "under_review", "in_progress"];
const MINIMUM_PICKUP_NOTICE_MS = 2 * 60 * 60 * 1000;
const isValidEmail = value => typeof value === 'string' && value.trim().length <= 254 && /^(?=.{1,64}@)[A-Z0-9.!#$%&'*+/=?^_~-]+@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$/i.test(value.trim()) && !value.trim().includes('..');
const normalizeVietnamPhone = value => {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return '';
  const compact = raw.replace(/[\s().-]/g, '');
  const national = compact.startsWith('+84') ? `0${compact.slice(3)}` : compact;
  return /^0[35789]\d{8}$/.test(national) ? national : null;
};
const dayStart = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const toId = value => ObjectId.isValid(value) ? new ObjectId(value) : null;
async function buildOperationsReport(repository, from, to) {
  const [bookings, incidents, fleetSize] = await Promise.all([repository.collection("bookings").find({
    start_at: {
      $gte: from,
      $lte: to
    }
  }).select({
    status: 1,
    vehicle_id: 1,
    rental_fee_amount: 1
  }).exec(), repository.collection("incident_cases").find({
    created_at: {
      $gte: from,
      $lte: to
    }
  }).select({
    status: 1
  }).exec(), repository.collection("vehicles").countDocuments({
    onboarding_status: "approved"
  })]);
  const byStatus = bookings.reduce((result, item) => {
    const key = item.status || "unknown";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const activeStatuses = new Set(["confirmed", "ongoing", "completed"]);
  const utilizedVehicles = new Set(bookings.filter(item => activeStatuses.has(item.status)).map(item => item.vehicle_id?.toString()).filter(Boolean)).size;
  const openIncidents = incidents.filter(item => OPEN_INCIDENT_STATUSES.includes(item.status)).length;
  return {
    from,
    to,
    bookings: {
      total: bookings.length,
      byStatus,
      rentalRevenue: bookings.reduce((sum, item) => sum + (Number(item.rental_fee_amount) || 0), 0)
    },
    fleet: {
      approvedVehicles: fleetSize,
      vehiclesWithBookings: utilizedVehicles,
      utilizationPct: fleetSize ? Math.round(utilizedVehicles / fleetSize * 1000) / 10 : 0
    },
    incidents: {
      total: incidents.length,
      open: openIncidents,
      resolved: incidents.length - openIncidents
    }
  };
}
function formatRequest(item, kind) {
  const createdAt = item.created_at || item.updated_at || new Date(0);
  const isVehicle = kind === "vehicle";
  return {
    id: item._id.toString(),
    code: isVehicle ? `XE-${item.license_plate || item._id.toString().slice(-6)}` : item.case_number,
    title: isVehicle ? `${item.brand || ""} ${item.model || ""} ${item.manufacture_year || ""}`.trim() || "Hồ sơ xe mới" : `Yêu cầu sự cố ${item.case_number}`,
    type: isVehicle ? "Hồ sơ xe mới" : "Khiếu nại & sự cố",
    owner: item.owner_name || "Chưa cập nhật người gửi",
    createdAt,
    status: item.onboarding_status || item.status
  };
}
export function createManagerService(repository) {
  const garage = createManagerGarageService(repository);
  async function expireStaleBookings(now = new Date()) {
    const bookings = repository.collection('bookings');
    const reviewDeadline = new Date(now.getTime() - BOOKING_REVIEW_WINDOW_MS);
    await bookings.updateMany({
      status: 'pending',
      $or: [{ hold_expires_at: { $lte: now } }, { hold_expires_at: { $exists: false }, created_at: { $lte: reviewDeadline } }],
    }, {
      $set: { status: 'expired', updated_at: now },
      $push: { status_history: { from: 'pending', to: 'expired', at: now, actor: 'system', reason: 'review_timeout' } },
    });
    await bookings.updateMany({
      status: 'awaiting_payment',
      $expr: { $and: [{ $ne: [bookingHoldExpression, null] }, { $lte: [bookingHoldExpression, now] }] },
    }, {
      $set: { status: 'expired', updated_at: now },
      $push: { status_history: { from: 'awaiting_payment', to: 'expired', at: now, actor: 'system', reason: 'payment_timeout' } },
    });
  }

  async function writeAudit(actorId, action, entityType, entityId, changes = {}) {
    await repository.collection('audit_logs').create({
      actor_user_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      sanitized_changes: changes,
      ip_address_masked: null,
      created_at: new Date()
    });
  }
  return {
    async authorizeDashboard(user) {
      const roleIds = [user.primary_role_id, ...(user.additional_role_ids || [])].filter(Boolean);
      const rows = await repository.collection('roles').find({
        _id: {
          $in: roleIds
        }
      }).select({
        code: 1
      }).exec();
      const codes = rows.map(row => row.code);
      if (!codes.some(code => ['MANAGER', 'ADMIN'].includes(code))) throw httpError(403, 'Bạn không có quyền xem trang quản lý.');
      return codes;
    },
    async bookings(input) {
      const { q = '', status = 'pending' } = input.query;
      if (typeof q !== 'string' || q.length > 100 || !['pending', 'all'].includes(status)) throw httpError(400, 'Bộ lọc booking không hợp lệ.');
      await expireStaleBookings();
      const filter = status === 'all' ? {} : { status: 'pending', 'review_info.required': { $ne: false } };
      if (q.trim()) {
        const pattern = new RegExp(escapeRegExp(q.trim()), 'i');
        filter.$or = [{ booking_code: pattern }, { status: pattern }];
      }
      const rows = await findPageRows(repository.collection('bookings'), filter, input.query, { sort: { created_at: -1 } });
      const renterIds = [...new Map(rows.map((row) => row.renter_id).filter(Boolean).map((id) => [id.toString(), id])).values()];
      const vehicleIds = [...new Map(rows.map((row) => row.vehicle_id).filter(Boolean).map((id) => [id.toString(), id])).values()];
      const [renters, vehicles] = await Promise.all([
        renterIds.length ? repository.collection('users').find({ _id: { $in: renterIds } }, { projection: { full_name: 1, email: 1, phone: 1 } }).exec() : [],
        vehicleIds.length ? repository.collection('vehicles').find({ _id: { $in: vehicleIds } }, { projection: { brand: 1, model: 1, license_plate: 1, manufacture_year: 1 } }).exec() : [],
      ]);
      const renterMap = new Map(renters.map((item) => [item._id.toString(), item]));
      const vehicleMap = new Map(vehicles.map((item) => [item._id.toString(), item]));
      return {
        data: rows.map((row) => ({
          id: row._id.toString(),
          bookingCode: row.booking_code,
          status: row.status,
          startAt: row.start_at,
          endAt: row.end_at,
          rentalFeeAmount: row.rental_fee_amount,
          renter: renterMap.get(row.renter_id?.toString()) || null,
          vehicle: vehicleMap.get(row.vehicle_id?.toString()) || null,
          createdAt: row.created_at,
        })),
        pagination: rows.pagination,
      };
    },
    async decideBooking(input) {
      const id = toId(input.id);
      if (!id) throw httpError(400, 'bookingId không hợp lệ.');
      const { action, reason } = parseManagerBookingDecision(input.body);
      const now = new Date();
      await expireStaleBookings(now);
      const booking = await repository.collection('bookings').findOne({ _id: id });
      if (!booking || booking.status !== 'pending' || isBookingHoldExpired(booking, now)) throw httpError(409, 'Booking không còn ở trạng thái chờ xử lý.');
      if (booking.review_info?.required === false) throw httpError(409, 'Yêu cầu này chuyển sang thanh toán sau khi hợp đồng đủ chữ ký.');
      if (action === 'approve' && (!(booking.start_at instanceof Date) || booking.start_at.getTime() < now.getTime() + MINIMUM_PICKUP_NOTICE_MS)) {
        throw httpError(409, 'Thời gian nhận xe phải còn tối thiểu 2 giờ; yêu cầu booking lịch mới.');
      }
      const status = action === 'approve' ? 'awaiting_payment' : 'rejected';
      const decision = action === 'approve' ? 'approved' : 'rejected';
      const paymentDeadline = action === 'approve' ? new Date(now.getTime() + BOOKING_PAYMENT_WINDOW_MS) : null;
      const result = await repository.collection('bookings').updateOne({ _id: id, status: 'pending' }, {
        $set: {
          status,
          updated_at: now,
          'review_info.required': true,
          'review_info.decision': decision,
          'review_info.reviewed_by': input.actorId,
          'review_info.reviewed_at': now,
          'review_info.reason': reason,
          ...(paymentDeadline ? { payment_deadline_at: paymentDeadline, hold_expires_at: paymentDeadline } : {}),
        },
        $push: { status_history: { from: 'pending', to: status, at: now, actor: input.actorId, reason } },
      });
      if (!result.modifiedCount) throw httpError(409, 'Booking không còn ở trạng thái chờ xử lý.');
      await writeAudit(input.actorId, `booking.${action}`, 'bookings', id, { status, reason });
      return { data: { id: id.toString(), status, decision, ...(paymentDeadline ? { paymentDeadline } : {}) } };
    },
    async listings(input) {
      const { q = '', status = 'all' } = input.query;
      const statuses = ['all', 'draft', 'pending_review', 'published', 'suspended', 'archived', 'rejected'];
      if (typeof q !== 'string' || q.length > 100 || !statuses.includes(status)) throw httpError(400, 'Bộ lọc tin xe không hợp lệ.');
      const filter = status === 'all' ? {} : { status };
      if (q.trim()) {
        const pattern = new RegExp(escapeRegExp(q.trim()), 'i');
        filter.$or = [{ title: pattern }, { description: pattern }];
      }
      const rows = await findPageRows(repository.collection('vehicle_listings'), filter, input.query, { sort: { updated_at: -1 } });
      const vehicleIds = [...new Map(rows.map((row) => row.vehicle_id).filter(Boolean).map((id) => [id.toString(), id])).values()];
      const vehicles = vehicleIds.length ? await repository.collection('vehicles').find({ _id: { $in: vehicleIds } }, {
        projection: { brand: 1, model: 1, license_plate: 1, manufacture_year: 1, owner_id: 1 },
      }).exec() : [];
      const ownerIds = [...new Map(vehicles.map((vehicle) => vehicle.owner_id).filter(Boolean).map((id) => [id.toString(), id])).values()];
      const owners = ownerIds.length ? await repository.collection('users').find({ _id: { $in: ownerIds } }, {
        projection: { full_name: 1, email: 1 },
      }).exec() : [];
      const vehicleMap = new Map(vehicles.map((item) => [item._id.toString(), item]));
      const ownerMap = new Map(owners.map((item) => [item._id.toString(), item]));
      return {
        data: rows.map((row) => {
          const vehicle = vehicleMap.get(row.vehicle_id?.toString());
          return {
            id: row._id.toString(),
            title: row.title,
            description: row.description || '',
            status: row.status,
            dailyPrice: row.daily_price,
            securityDepositAmount: row.security_deposit_amount,
            pickupLocation: row.pickup_location || {},
            vehicle: vehicle ? {
              id: vehicle._id.toString(),
              brand: vehicle.brand,
              model: vehicle.model,
              licensePlate: vehicle.license_plate,
              year: vehicle.manufacture_year,
              owner: ownerMap.get(vehicle.owner_id?.toString()) || null,
            } : null,
            updatedAt: row.updated_at,
          };
        }),
        pagination: rows.pagination,
      };
    },
    async updateListing(input) {
      const id = toId(input.id);
      if (!id) throw httpError(400, 'listingId không hợp lệ.');
      const changes = parseManagerListingUpdate(input.body);
      const now = new Date();
      const result = await repository.collection('vehicle_listings').updateOne({ _id: id }, {
        $set: { ...changes, updated_at: now, updated_by_manager_id: input.actorId },
      });
      if (!result.matchedCount) throw httpError(404, 'Không tìm thấy tin xe.');
      await writeAudit(input.actorId, 'listing.update', 'vehicle_listings', id, Object.keys(changes));
      return { data: { id: id.toString(), updatedAt: now } };
    },
    async reviewListing(input) {
      const id = toId(input.id);
      if (!id) throw httpError(400, 'listingId không hợp lệ.');
      const { action, reason } = parseManagerListingReview(input.body);
      const transitions = {
        approve: ['published', ['draft', 'pending_review', 'suspended']],
        reject: ['archived', ['draft', 'pending_review', 'published']],
        activate: ['published', ['suspended', 'archived']],
        deactivate: ['suspended', ['published']],
      };
      const [next, expected] = transitions[action];
      const listings = repository.collection('vehicle_listings');
      const current = await listings.findOne({ _id: id });
      if (!current) throw httpError(404, 'Không tìm thấy tin xe.');
      if (!expected.includes(current.status)) throw httpError(409, 'Trạng thái tin xe không cho phép thao tác này.');
      if (action === 'approve' || action === 'activate') {
        return garageTransaction(repository, async (session) => {
          const options = { session };
          const listing = await listings.findOne({ _id: id }, options);
          if (!listing || !expected.includes(listing.status)) throw httpError(409, 'Trạng thái tin xe đã thay đổi.');
          const vehicle = await repository.collection('vehicles').findOne({ _id: listing.vehicle_id }, options);
          if (!vehicle || vehicle.onboarding_status !== 'approved' || vehicle.physical_status !== 'at_garage') {
            throw httpError(409, 'Chỉ xuất bản xe đã được duyệt và tiếp nhận vào gara.');
          }
          if (!Number.isSafeInteger(listing.daily_price) || listing.daily_price <= 0
            || !Number.isSafeInteger(listing.security_deposit_amount) || listing.security_deposit_amount < 0
            || !listing.pickup_location?.branch_name?.trim() || !listing.pickup_location?.city?.trim()
            || !listing.pickup_location?.address_label?.trim()) {
            throw httpError(409, 'Cần giá thuê, tiền cọc và địa điểm giao xe đầy đủ trước khi xuất bản.');
          }
          const now = new Date();
          const agreement = await repository.collection('management_agreements').findOne({
            vehicle_id: vehicle._id,
            status: 'active',
            start_date: { $lte: now },
            end_date: { $gt: now },
            'signature_info.owner_signed_at': { $type: 'date' },
            'signature_info.platform_signed_at': { $type: 'date' },
            'authorization_scope.rental_contract_signing': true,
            'authorization_scope.vehicle_custody': true,
          }, options);
          if (!agreement || !await repository.collection('vehicle_intakes').findOne({
            vehicle_id: vehicle._id,
            management_agreement_id: agreement._id,
            status: 'completed',
          }, options)) {
            throw httpError(409, 'Cần hợp đồng còn hiệu lực và biên bản tiếp nhận thuộc đúng hợp đồng.');
          }
          const locked = await repository.collection('vehicles').updateOne({
            _id: vehicle._id,
            onboarding_status: 'approved',
            physical_status: 'at_garage',
          }, { $inc: { renter_calendar_version: 1 } }, options);
          if (locked.modifiedCount !== 1) throw httpError(409, 'Trạng thái xe đã thay đổi.');
          const result = await listings.updateOne({ _id: id, status: { $in: expected } }, {
            $set: {
              status: next,
              published_at: now,
              updated_at: now,
              handled_by: input.actorId,
              handled_at: now,
              manager_review_note: reason,
            },
          }, options);
          if (result.modifiedCount !== 1) throw httpError(409, 'Trạng thái tin xe đã thay đổi.');
          await repository.collection('audit_logs').create({
            actor_user_id: input.actorId,
            action: `listing.${action}`,
            entity_type: 'vehicle_listings',
            entity_id: id,
            sanitized_changes: { status: next, reason },
            created_at: now,
          }, options);
          return { data: { id: id.toString(), status: next } };
        });
      }
      const now = new Date();
      const result = await listings.updateOne({ _id: id, status: { $in: expected } }, {
        $set: { status: next, updated_at: now, handled_by: input.actorId, handled_at: now, manager_review_note: reason },
      });
      if (!result.modifiedCount) throw httpError(409, 'Trạng thái tin xe không cho phép thao tác này.');
      await writeAudit(input.actorId, `listing.${action}`, 'vehicle_listings', id, { status: next, reason });
      return { data: { id: id.toString(), status: next } };
    },
    accounts: async input => {
      const {
        q = "",
        status = "all",
        role = "all"
      } = input.query;
      const match = {};
      if (status !== "all") match.account_status = status;
      if (typeof q === "string" && q.trim()) {
        const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        match.$or = [{
          full_name: {
            $regex: safe,
            $options: "i"
          }
        }, {
          email: {
            $regex: safe,
            $options: "i"
          }
        }, {
          phone: {
            $regex: safe,
            $options: "i"
          }
        }];
      }
      const roles = await repository.collection('roles').find({}).exec();
      if (role !== 'all') {
        const roleId = roles.find((item) => item.code === role)?._id;
        match.$and = [{ $or: [{ primary_role_id: roleId || null }, { additional_role_ids: roleId || null }] }];
        if (!roleId) match._id = { $in: [] };
      }
      const users = await findPageRows(repository.collection('users'), match, input.query, { projection: {
        password_hash: 0,
        identity_kyc: 0,
        driver_license: 0,
        payout_profile: 0
      }, sort: {
        created_at: -1
      } });
      const roleMap = new Map(roles.map(item => [item._id.toString(), item]));
      const data = users.map(user => {
        const roleIds = [user.primary_role_id, ...(user.additional_role_ids || [])].filter(Boolean);
        const userRoles = roleIds.map(id => roleMap.get(id.toString())).filter(Boolean);
        return {
          id: user._id.toString(),
          name: user.full_name,
          email: user.email,
          phone: user.phone,
          status: user.account_status,
          roles: userRoles.map(item => item.code),
          roleNames: userRoles.map(item => item.display_name),
          createdAt: user.created_at
        };
      }).filter(item => role === "all" || item.roles.includes(role));
      return {
        data, pagination: users.pagination
      };
    },
    createAccount: async input => {
      const {
        name,
        email,
        phone = "",
        password,
        roles: roleCodes = [],
        status = "active"
      } = input.body || {};
      const normalizedPhone = normalizeVietnamPhone(phone);
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120 || !isValidEmail(email) || normalizedPhone === null || typeof password !== "string" || password.length < 8 || password.length > 128 || !Array.isArray(roleCodes) || !roleCodes.length || roleCodes.some(code => typeof code !== "string" || !code.trim()) || !["active", "suspended"].includes(status)) {
        throw httpError(400, "Thông tin tài khoản không hợp lệ; mật khẩu phải có ít nhất 8 ký tự.");
      }
      const normalizedRoleCodes = [...new Set(roleCodes.map(code => code.trim().toUpperCase()))];
      if (normalizedRoleCodes.includes("ADMIN")) throw httpError(400, "Không thể tạo tài khoản có quyền Admin.");
      const normalizedEmail = email.trim().toLowerCase();
      const users = repository.collection("users");
      if (await users.findOne({
        email: {
          $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          $options: "i"
        }
      })) {
        throw httpError(409, "Email đã được sử dụng.");
      }
      const roleRows = await repository.collection("roles").find({
        code: {
          $in: normalizedRoleCodes
        }
      }).exec();
      if (roleRows.length !== normalizedRoleCodes.length) throw httpError(400, "Một hoặc nhiều vai trò không tồn tại.");
      const now = new Date();
      const inserted = await users.create({
        full_name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password_hash: await bcrypt.hash(password, 12),
        primary_role_id: roleRows[0]._id,
        additional_role_ids: roleRows.slice(1).map(item => item._id),
        account_status: status,
        created_at: now,
        updated_at: now
      });
      await writeAudit(input.actorId, "account.create", "users", inserted._id, {
        roles: roleRows.map(item => item.code),
        status
      });
      return {
        data: {
          id: inserted._id.toString(),
          name: name.trim(),
          email: normalizedEmail,
          status,
          roles: roleRows.map(item => item.code)
        }
      };
    },
    updateAccount: async input => {
      const id = toId(input.id);
      const {
        status,
        roles: roleCodes
      } = input.body || {};
      if (!id || status === undefined && roleCodes === undefined) throw httpError(400, "Thông tin cập nhật không hợp lệ.");
      if (status !== undefined && !["active", "suspended"].includes(status)) throw httpError(400, "Trạng thái tài khoản không hợp lệ.");
      const target = await repository.collection("users").findOne({
        _id: id
      });
      if (!target) throw httpError(404, "Không tìm thấy tài khoản.");
      const adminRole = await repository.collection("roles").findOne({
        code: "ADMIN"
      });
      const targetRoleIds = [target.primary_role_id, ...(target.additional_role_ids || [])].filter(Boolean);
      const targetIsAdmin = Boolean(adminRole && targetRoleIds.some(roleId => roleId.equals(adminRole._id)));
      if (id.equals(input.actorId) && (status === "suspended" || roleCodes && !roleCodes.includes("ADMIN"))) {
        throw httpError(400, "Không thể khóa hoặc gỡ quyền Admin của tài khoản đang đăng nhập.");
      }
      const update = {
        updated_at: new Date()
      };
      if (status !== undefined) update.account_status = status;
      if (roleCodes !== undefined) {
        if (!Array.isArray(roleCodes) || !roleCodes.length) throw httpError(400, "Tài khoản phải có ít nhất một vai trò.");
        const roles = await repository.collection("roles").find({
          code: {
            $in: [...new Set(roleCodes)]
          }
        }).exec();
        if (roles.length !== new Set(roleCodes).size) throw httpError(400, "Một hoặc nhiều vai trò không tồn tại.");
        if (!targetIsAdmin && roles.some(item => item.code === "ADMIN")) throw httpError(400, "Không thể cấp quyền Admin qua chỉnh sửa tài khoản.");
        if (targetIsAdmin && !roles.some(item => item.code === "ADMIN")) throw httpError(400, "Không thể gỡ quyền Admin của một Admin khác.");
        update.primary_role_id = roles[0]._id;
        update.additional_role_ids = roles.slice(1).map(item => item._id);
      }
      await repository.collection("users").updateOne({
        _id: id
      }, {
        $set: update
      });
      await writeAudit(input.actorId, "account.update", "users", id, {
        ...(status ? {
          status
        } : {}),
        ...(roleCodes ? {
          roles: roleCodes
        } : {})
      });
      return {
        data: {
          id: id.toString(),
          ...(status ? {
            status
          } : {}),
          ...(roleCodes ? {
            roles: roleCodes
          } : {})
        }
      };
    },
    roles: async input => {
      const rows = await findPageRows(repository.collection("roles"), {}, input.query, {
        sort: {
          code: 1
        }
      });
      return {
        data: rows.map(item => ({
          id: item._id.toString(),
          code: item.code,
          name: item.display_name,
          description: item.description,
          permissions: item.permissions || []
        })),
        pagination: rows.pagination
      };
    },
    createRole: async input => {
      const {
        code,
        name,
        description = "",
        permissions = []
      } = input.body || {};
      if (typeof code !== "string" || !/^[A-Z][A-Z0-9_]{1,49}$/.test(code) || typeof name !== "string" || !name.trim() || name.length > 100 || typeof description !== "string" || description.length > 500 || !Array.isArray(permissions) || permissions.length > 200 || permissions.some(item => typeof item !== "string" || !/^[a-z][a-z0-9._:-]{1,79}$/.test(item))) {
        throw httpError(400, "Thông tin vai trò hoặc quyền không hợp lệ.");
      }
      if (await repository.collection("roles").findOne({
        code
      })) throw httpError(409, "Mã vai trò đã tồn tại.");
      const now = new Date();
      const role = {
        code,
        display_name: name.trim(),
        description: description.trim(),
        permissions: [...new Set(permissions)],
        created_at: now,
        updated_at: now
      };
      const inserted = await repository.collection("roles").create(role);
      await writeAudit(input.actorId, "role.create", "roles", inserted._id, {
        code,
        name: role.display_name,
        permissions: role.permissions
      });
      return {
        data: {
          id: inserted._id.toString(),
          code,
          name: role.display_name,
          description: role.description,
          permissions: role.permissions
        }
      };
    },
    updateRole: async input => {
      const id = toId(input.id);
      const {
        permissions,
        name,
        description
      } = input.body || {};
      if (!id || !Array.isArray(permissions) && name === undefined && description === undefined) throw httpError(400, "Thông tin vai trò không hợp lệ.");
      if (permissions !== undefined && (!Array.isArray(permissions) || permissions.some(item => typeof item !== "string" || !/^[a-z][a-z0-9._:-]{1,79}$/.test(item)))) throw httpError(400, "Danh sách quyền không hợp lệ.");
      if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 100)) throw httpError(400, "Tên vai trò không hợp lệ.");
      if (description !== undefined && (typeof description !== "string" || description.length > 500)) throw httpError(400, "Mô tả vai trò không hợp lệ.");
      const set = {
        updated_at: new Date()
      };
      if (permissions !== undefined) set.permissions = [...new Set(permissions)];
      if (name !== undefined) set.display_name = name.trim();
      if (description !== undefined) set.description = description.trim();
      const result = await repository.collection("roles").updateOne({
        _id: id
      }, {
        $set: set
      });
      if (!result.matchedCount) throw httpError(404, "Không tìm thấy vai trò.");
      await writeAudit(input.actorId, "role.update", "roles", id, set);
      return {
        data: {
          id: id.toString(),
          ...set
        }
      };
    },
    auditLogs: async input => {
      const match = {};
      for (const key of ["action", "entity_type"]) if (typeof input.query[key] === "string" && input.query[key].trim()) match[key] = input.query[key].trim();
      if (input.query.from || input.query.to) {
        match.created_at = {};
        if (input.query.from && !Number.isNaN(Date.parse(input.query.from))) match.created_at.$gte = new Date(input.query.from);
        if (input.query.to && !Number.isNaN(Date.parse(input.query.to))) {
          match.created_at.$lte = new Date(input.query.to);
          if (input.query.to.length === 10) match.created_at.$lte.setHours(23, 59, 59, 999);
        }
      }
      const logs = repository.collection("audit_logs");
      const rows = await findPageRows(logs, match, { ...input.query, page: input.query.page ?? '1', limit: input.query.limit ?? '25' }, { sort: { created_at: -1 } });
      const actorIds = [...new Map(rows.map(row => row.actor_user_id).filter(Boolean).map(id => [id.toString(), id])).values()];
      const actors = actorIds.length ? await repository.collection("users").find({
        _id: {
          $in: actorIds
        }
      }).select({
        full_name: 1,
        email: 1
      }).exec() : [];
      const actorMap = new Map(actors.map(item => [item._id.toString(), item]));
      return {
        data: rows.map(row => ({
          id: row._id.toString(),
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id?.toString() || null,
          actor: actorMap.get(row.actor_user_id?.toString())?.full_name || "System",
          actorEmail: actorMap.get(row.actor_user_id?.toString())?.email || null,
          changes: row.sanitized_changes || {},
          ipAddressMasked: row.ip_address_masked || null,
          createdAt: row.created_at
        })),
        pagination: rows.pagination
      };
    },
    adminOverview: async () => {
      const users = repository.collection("users");
      const roles = repository.collection("roles");
      const logs = repository.collection("audit_logs");
      const [accountCount, activeAccountCount, allRoles, latestLogs] = await Promise.all([
        users.countDocuments({}),
        users.countDocuments({ account_status: "active" }),
        roles.find({}).select({ code: 1, display_name: 1 }).exec(),
        logs.find({}).sort({ created_at: -1 }).limit(5).exec()
      ]);
      const mainRoles = allRoles.filter(role => role.code !== "ADMIN" && !/(viewer|lead|profile|audit|finance)/i.test(`${role.code} ${role.display_name || ''}`));
      const actorIds = [...new Map(latestLogs.map(log => log.actor_user_id).filter(Boolean).map(id => [id.toString(), id])).values()];
      const actors = actorIds.length ? await users.find({ _id: { $in: actorIds } }).select({ full_name: 1, email: 1 }).exec() : [];
      const actorMap = new Map(actors.map(actor => [actor._id.toString(), actor]));
      return { data: {
        accountCount,
        activeAccountCount,
        roleCount: mainRoles.length,
        roles: mainRoles.map(role => ({ code: role.code, name: role.display_name })),
        recentLogs: latestLogs.map(log => {
          const actor = actorMap.get(log.actor_user_id?.toString());
          return { id: log._id.toString(), action: log.action, entityType: log.entity_type, entityId: log.entity_id?.toString() || null, actor: actor?.full_name || "Hệ thống", actorEmail: actor?.email || null, changes: log.sanitized_changes || {}, createdAt: log.created_at || null };
        })
      } };
    },
    systemReports: async input => {
      const filter = input.currentRoles?.includes("MANAGER") ? {} : {
        report_type: "finance"
      };
      const rows = await findPageRows(repository.collection("system_reports"), filter, input.query, {
        sort: {
          generated_at: -1
        }
      });
      return {
        data: rows.map(item => ({
          id: item._id.toString(),
          type: item.report_type,
          title: item.title,
          from: item.period_from,
          to: item.period_to,
          generatedAt: item.generated_at
        })),
        pagination: rows.pagination
      };
    },
    systemReport: async input => {
      const id = toId(input.id);
      if (!id) throw httpError(400, "Mã báo cáo không hợp lệ.");
      const filter = input.currentRoles?.includes("MANAGER") ? {
        _id: id
      } : {
        _id: id,
        report_type: "finance"
      };
      const report = await repository.collection("system_reports").findOne(filter);
      if (!report) throw httpError(404, "Không tìm thấy báo cáo.");
      return {
        data: {
          id: report._id.toString(),
          type: report.report_type,
          title: report.title,
          from: report.period_from,
          to: report.period_to,
          generatedAt: report.generated_at,
          report: report.report_data
        }
      };
    },
    saveSystemReport: async input => {
      const {
        type,
        from: fromValue,
        to: toValue
      } = input.body || {};
      if (!["finance", "operations"].includes(type)) throw httpError(400, "Loại báo cáo không hợp lệ.");
      if (type === "operations" && !input.currentRoles?.includes("MANAGER")) throw httpError(403, "Chỉ Manager được tạo báo cáo hoạt động.");
      const from = fromValue ? new Date(fromValue) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = toValue ? new Date(toValue) : new Date();
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw httpError(400, "Khoảng ngày báo cáo không hợp lệ.");
      if (typeof toValue === "string" && toValue.length === 10) to.setUTCHours(23, 59, 59, 999);
      let data;
      if (type === "operations") data = await buildOperationsReport(repository, from, to);else {
        const rows = await repository.collection("owner_settlements").find({
          settled_at: {
            $gte: from,
            $lte: to
          },
          payout_status: "paid"
        }).select({
          settled_at: 1,
          gross_rental_revenue: 1,
          platform_commission: 1,
          net_owner_payout: 1
        }).sort({
          settled_at: 1
        }).exec();
        data = {
          from,
          to,
          totals: rows.reduce((sum, item) => ({
            grossRentalRevenue: sum.grossRentalRevenue + (Number(item.gross_rental_revenue) || 0),
            platformCommission: sum.platformCommission + (Number(item.platform_commission) || 0),
            ownerPayout: sum.ownerPayout + (Number(item.net_owner_payout) || 0)
          }), {
            grossRentalRevenue: 0,
            platformCommission: 0,
            ownerPayout: 0
          }),
          count: rows.length
        };
      }
      const now = new Date();
      const inserted = await repository.collection("system_reports").create({
        report_type: type,
        title: type === "finance" ? "Báo cáo tài chính" : "Báo cáo hoạt động",
        period_from: from,
        period_to: to,
        report_data: data,
        generated_by: input.actorId,
        generated_at: now
      });
      await writeAudit(input.actorId, "report.generated", "system_reports", inserted._id, {
        report_type: type,
        period_from: from,
        period_to: to
      });
      return {
        data: {
          id: inserted._id.toString(),
          type,
          title: type === "finance" ? "Báo cáo tài chính" : "Báo cáo hoạt động",
          generatedAt: now
        }
      };
    },
    dashboard: async input => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const period = ["30d", "month"].includes(input.query.period) ? input.query.period : "7d";
      const numberOfDays = period === "month" ? today.getDate() : period === "30d" ? 30 : 7;
      const periodStart = period === "month" ? monthStart : dayStart(today);
      if (period !== "month") periodStart.setDate(periodStart.getDate() - numberOfDays + 1);
      const seriesStart = new Date(periodStart);
      const vehicles = repository.collection("vehicles");
      const listings = repository.collection("vehicle_listings");
      const incidents = repository.collection("incident_cases");
      const settlements = repository.collection("owner_settlements");
      const auditLogs = repository.collection("audit_logs");
      const users = repository.collection("users");
      const roles = repository.collection("roles");
      const [activeVehicles, pendingVehicleCount, openIncidents, approvedSettlements, monthSettlements, roleDocs, requestVehicles, requestIncidents, recentLogs] = await Promise.all([listings.countDocuments({
        status: "published"
      }), vehicles.countDocuments({
        onboarding_status: {
          $in: ["submitted", "pending_review", "revision_required"]
        }
      }), incidents.countDocuments({
        status: {
          $in: OPEN_INCIDENT_STATUSES
        }
      }), settlements.find({
        settled_at: {
          $gte: seriesStart
        },
        payout_status: "paid"
      }).select({
        settled_at: 1,
        platform_commission: 1
      }).exec(), settlements.find({
        settled_at: {
          $gte: monthStart
        },
        payout_status: "paid"
      }).select({
        platform_commission: 1
      }).exec(), roles.find({
        code: {
          $in: STAFF_ROLES
        }
      }).select({
        _id: 1
      }).exec(), vehicles.find({
        onboarding_status: {
          $in: ["submitted", "pending_review", "revision_required"]
        }
      }).sort({
        created_at: -1
      }).limit(10).exec(), incidents.find({
        status: {
          $in: OPEN_INCIDENT_STATUSES
        }
      }).sort({
        updated_at: -1,
        created_at: -1
      }).limit(10).exec(), auditLogs.find({}).sort({
        created_at: -1
      }).limit(6).exec()]);
      const ownerIds = requestVehicles.map(vehicle => vehicle.owner_id).filter(Boolean);
      const reporterIds = requestIncidents.map(incident => incident.reported_by_user_id).filter(Boolean);
      const actorIds = recentLogs.map(log => log.actor_user_id).filter(Boolean);
      const peopleIds = [...new Map([...ownerIds, ...reporterIds, ...actorIds].map(id => [id.toString(), id])).values()];
      const people = peopleIds.length ? await users.find({
        _id: {
          $in: peopleIds
        }
      }).select({
        full_name: 1
      }).exec() : [];
      const personNames = new Map(people.map(person => [person._id.toString(), person.full_name]));
      const pending = requestVehicles.map(vehicle => ({
        ...vehicle,
        owner_name: personNames.get(vehicle.owner_id?.toString())
      })).map(vehicle => formatRequest(vehicle, "vehicle"));
      const cases = requestIncidents.map(incident => ({
        ...incident,
        owner_name: personNames.get(incident.reported_by_user_id?.toString())
      })).map(incident => formatRequest(incident, "incident"));
      const dashboardRequests = [...pending, ...cases].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
      const daily = Array.from({
        length: numberOfDays
      }, (_, index) => {
        const date = new Date(seriesStart);
        date.setDate(date.getDate() + index);
        return {
          date: date.toISOString().slice(0, 10),
          amount: 0
        };
      });
      const seriesByDate = new Map(daily.map(item => [item.date, item]));
      for (const settlement of approvedSettlements) {
        if (!settlement.settled_at) continue;
        const key = dayStart(new Date(settlement.settled_at)).toISOString().slice(0, 10);
        const point = seriesByDate.get(key);
        if (point) point.amount += Number(settlement.platform_commission) || 0;
      }
      const activities = recentLogs.map(log => ({
        id: log._id.toString(),
        action: log.action || "system.activity",
        entityType: log.entity_type || "system",
        entityId: log.entity_id?.toString() || null,
        actor: personNames.get(log.actor_user_id?.toString()) || "Hệ thống",
        createdAt: log.created_at || null
      }));
      const staffRoleIds = roleDocs.map(role => role._id);
      const [staffCount, lastPeriodSettlements] = await Promise.all([staffRoleIds.length ? users.countDocuments({
        account_status: "active",
        $or: [{
          primary_role_id: {
            $in: staffRoleIds
          }
        }, {
          additional_role_ids: {
            $in: staffRoleIds
          }
        }]
      }) : 0, settlements.find({
        settled_at: {
          $gte: new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1),
          $lt: monthStart
        },
        payout_status: "paid"
      }).select({
        platform_commission: 1
      }).exec()]);
      const monthRevenue = monthSettlements.reduce((total, item) => total + (Number(item.platform_commission) || 0), 0);
      const previousRevenue = lastPeriodSettlements.reduce((total, item) => total + (Number(item.platform_commission) || 0), 0);
      const changePercent = previousRevenue ? Math.round((monthRevenue - previousRevenue) / previousRevenue * 1000) / 10 : null;
      return {
        data: {
          period,
          metrics: {
            activeVehicles,
            pendingVehicles: pendingVehicleCount,
            openIncidents,
            monthlyPlatformRevenue: monthRevenue,
            staffCount,
            revenueChangePercent: changePercent
          },
          revenue: {
            total: daily.reduce((total, item) => total + item.amount, 0),
            series: daily
          },
          requests: dashboardRequests,
          activities: input.currentRoles?.includes("ADMIN") ? activities : []
        }
      };
    },
    vehicles: async input => {
      const status = input.query.status || "pending";
      const match = status === "all" ? {} : {
        onboarding_status: status === "pending" ? {
          $in: ["submitted", "pending_review", "revision_required"]
        } : status
      };
      const items = await findPageRows(repository.collection("vehicles"), match, input.query, {
        sort: {
          updated_at: -1
        }
      });
      const owners = [...new Set(items.map(item => item.owner_id?.toString()).filter(Boolean))].map(id => new ObjectId(id));
      const ownerRows = owners.length ? await repository.collection("users").find({
        _id: {
          $in: owners
        }
      }).select({
        full_name: 1,
        email: 1
      }).exec() : [];
      const ownerMap = new Map(ownerRows.map(owner => [owner._id.toString(), owner]));
      const itemIds = items.map(item => item._id);
      const inspections = itemIds.length ? await repository.collection("vehicle_inspections").find({
        inspection_type: 'onboarding',
        vehicle_id: {
          $in: itemIds
        }
      }).sort({
        created_at: -1,
        _id: -1
      }).exec() : [];
      const inspectionMap = new Map();
      for (const inspection of inspections) if (!inspectionMap.has(inspection.vehicle_id.toString())) inspectionMap.set(inspection.vehicle_id.toString(), inspection);
      return {
        data: items.map(item => ({
          id: item._id.toString(),
          licensePlate: item.license_plate,
          brand: item.brand,
          model: item.model,
          year: item.manufacture_year,
          seats: item.seats,
          fuelType: item.fuel_type,
          transmission: item.transmission,
          dailyPrice: item.daily_price,
          conditionDeclaration: item.condition_declaration || '',
          physicalStatus: item.physical_status,
          status: item.onboarding_status,
          reviewNote: item.review_note || "",
          documents: item.documents || {},
          inspection: inspectionMap.get(item._id.toString()) ? {
            id: inspectionMap.get(item._id.toString())._id,
            version: inspectionMap.get(item._id.toString()).version ?? 0,
            staffId: inspectionMap.get(item._id.toString()).garage_staff_id,
            ownerReview: inspectionMap.get(item._id.toString()).owner_review,
            operatorReviewRequired: Boolean(inspectionMap.get(item._id.toString()).arrival_review || item.inspection_schedule_request?.status === 'confirmed'),
            operatorReview: inspectionMap.get(item._id.toString()).operator_review,
            conditionReport: inspectionMap.get(item._id.toString()).condition_report || {},
            decisionReason: inspectionMap.get(item._id.toString()).decision_reason || '',
            status: inspectionMap.get(item._id.toString()).approval_status,
            recommendation: inspectionMap.get(item._id.toString()).recommendation,
            inspectedAt: inspectionMap.get(item._id.toString()).inspected_at
          } : null,
          owner: ownerMap.get(item.owner_id?.toString()) || null,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        })),
        pagination: items.pagination
      };
    },
    reviewVehicle: input => garage.reviewVehicle(input),
    vehicleDocument: async input => {
      const id = toId(input.id);
      const kinds = { registration: 'registration', inspection: 'inspection_certificate', insurance: 'insurance' };
      const kind = kinds[input.kind];
      if (!id || !kind || !repository.readPrivateFile) throw httpError(400, 'Tài liệu xe không hợp lệ.');
      const vehicle = await repository.collection('vehicles').findOne({ _id: id }, { projection: { documents: 1 } });
      const key = vehicle?.documents?.[kind]?.file_key;
      if (!key) throw httpError(404, 'Không tìm thấy tài liệu xe.');
      const bytes = await repository.readPrivateFile(key);
      const contentType = vehicleDocumentContentType(bytes) || (key.endsWith('.pdf') ? 'application/pdf' : key.endsWith('.png') ? 'image/png' : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
      return { bytes, contentType };
    },
    incidents: async input => {
      const status = input.query.status || "open";
      const match = status === 'all' ? {} : status === 'open' ? {
        $or: [
          { status: { $in: OPEN_INCIDENT_STATUSES } },
          { 'compensation_claims.settlement_status': 'pending_settlement' },
        ],
      } : { status };
      const items = await findPageRows(repository.collection("incident_cases"), match, input.query, {
        sort: {
          updated_at: -1
        }
      });
      const returns = await repository.findIncidentHandovers(items.map((item) => item.source_handover_id).filter(Boolean));
      const pickups = await repository.findIncidentHandovers(returns.map((item) => item.baseline_handover_id).filter(Boolean));
      const withdrawals = await repository.findWithdrawalHandovers(items.map((item) => item.source_withdrawal_id).filter(Boolean));
      const intakes = await repository.findIntakeHandovers(withdrawals.map((item) => item.owner_return_handover?.intake_id).filter(Boolean));
      const intakeById = new Map(intakes.map((item) => [String(item._id), item]));
      const withdrawalById = new Map(withdrawals.map((item) => [String(item._id), item.owner_return_handover]));
      const returnById = new Map(returns.map((item) => [String(item._id), item]));
      const pickupById = new Map(pickups.map((item) => [String(item._id), item]));
      return {
        data: items.map(item => {
          const ownerReturn = withdrawalById.get(String(item.source_withdrawal_id));
          const intake = intakeById.get(String(ownerReturn?.intake_id));
          return {
          id: item._id.toString(),
          ownerConditionComparison: ownerReturn ? {
            pickup: intake && { _id: intake._id, vehicle_condition: intake.condition_snapshot },
            returned: { _id: item.source_withdrawal_id, vehicle_condition: ownerReturn.condition, damage_changes: ownerReturn.damage_changes },
          } : null,
          conditionComparison: item.source_handover_id ? {
            returned: returnById.get(String(item.source_handover_id)),
            pickup: pickupById.get(String(returnById.get(String(item.source_handover_id))?.baseline_handover_id)),
          } : null,
          sourceWithdrawalId: item.source_withdrawal_id,
          caseNumber: item.case_number,
          responseChecklist: item.response_checklist,
          timeline: (item.operation_timeline || []).map(({ action, at, note }) => ({ action, at, note })),
          resolution: item.resolution?.note ? { note: item.resolution.note } : null,
          caseType: item.case_type,
          vehicleSeized: typeof item.vehicle_seized === 'boolean' ? item.vehicle_seized : null,
          status: item.status,
          description: item.description,
          investigation: item.investigation || {},
          trafficViolation: item.traffic_violation_details || null,
          compensationClaims: item.compensation_claims || [],
          evidence: item.evidence || [],
          bookingId: item.booking_id?.toString(),
          vehicleId: item.vehicle_id?.toString(),
          createdAt: item.created_at,
          updatedAt: item.updated_at
          };
        }),
        pagination: items.pagination
      };
    },
    reviewCompensation: input => garage.reviewCompensation(input),
    reviewIncident: input => garage.reviewIncident(input),
    reviewTrafficViolation: async input => {
      const id = toId(input.id);
      const { decision, amount, note = "" } = input.body || {};
      if (!id || !["approve", "reject"].includes(decision) || typeof note !== "string" || !note.trim() || note.length > 1000 || decision === "approve" && (!Number.isSafeInteger(amount) || amount < 0)) throw httpError(400, "Thông tin quyết định vi phạm không hợp lệ.");
      const cases = repository.collection("incident_cases");
      const incident = await cases.findOne({ _id: id, case_type: "traffic_violation", status: "pending_manager", "traffic_violation_details.official_confirmation": "pending_manager_review" });
      if (!incident) throw httpError(409, "Vi phạm chưa được Operator chuyển đến Manager hoặc đã có quyết định.");
      const claimed = incident.traffic_violation_details?.fine_amount_claimed;
      if (decision === "approve" && Number.isFinite(claimed) && amount > claimed) throw httpError(400, "Khoản phạt được duyệt không được vượt quá số tiền có chứng cứ.");
      const now = new Date();
      const status = decision === "approve" ? "resolved" : "closed";
      const result = await cases.updateOne({ _id: id, case_type: "traffic_violation", status: "pending_manager", "traffic_violation_details.official_confirmation": "pending_manager_review" }, { $set: {
        status, reviewed_by_manager_id: input.actorId, updated_at: now,
        "investigation.review_status": decision === "approve" ? "approved" : "rejected",
        "traffic_violation_details.official_confirmation": decision === "approve" ? "confirmed" : "rejected",
        "traffic_violation_details.penalty_fee": decision === "approve" ? amount : 0,
        resolution: { outcome: decision === "approve" ? "traffic_violation_approved" : "traffic_violation_rejected", amount: decision === "approve" ? amount : 0, note: note.trim(), resolved_at: now },
      } });
      if (!result.modifiedCount) throw httpError(409, "Vi phạm vừa được một Manager khác xử lý.");
      await writeAudit(input.actorId, `traffic_violation.${decision}`, "incident_cases", id, { amount: decision === "approve" ? amount : 0, note: note.trim() });
      return { data: { id: id.toString(), status, decision } };
    },
    policies: async input => {
      const data = await findPageRows(repository.collection("platform_policies"), {
        status: "active"
      }, input.query, {
        sort: {
          policy_type: 1
        }
      });
      return {
        data: data.map(item => ({
          id: item._id.toString(),
          type: item.policy_type,
          version: item.version,
          config: item.config,
          effectiveFrom: item.effective_from
        })),
        pagination: data.pagination
      };
    },
    updatePolicy: async input => {
      const type = input.type;
      const config = input.body?.config;
      const allowed = ["commission_default", "cancellation", "deposit_refund", "late_return", "mileage", "damage_handling", "traffic_violation", "withdrawal", "vehicle_approval", "listing_publication"];
      if (!allowed.includes(type) || !config || typeof config !== "object" || Array.isArray(config)) {
        throw httpError(400, "Loại hoặc cấu hình chính sách không hợp lệ.");
      }
      const numericValues = Object.values(config).filter(value => typeof value === "number");
      if (numericValues.some(value => !Number.isFinite(value) || value < 0) || type === "commission_default" && (config.default_commission_pct < 0 || config.default_commission_pct > 100)) {
        throw httpError(400, "Giá trị chính sách nằm ngoài giới hạn cho phép.");
      }
      const policies = repository.collection("platform_policies");
      const now = new Date();
      const previous = await policies.findOne({
        policy_type: type,
        status: "active"
      }, {
        sort: {
          version: -1
        }
      });
      const version = (previous?.version || 0) + 1;
      await policies.updateMany({
        policy_type: type,
        status: "active"
      }, {
        $set: {
          status: "superseded",
          effective_until: now
        }
      });
      const inserted = await policies.create({
        policy_type: type,
        version,
        config,
        effective_from: now,
        effective_until: null,
        updated_by_manager_id: input.actorId,
        status: "active",
        created_at: now
      });
      await writeAudit(input.actorId, "policy.update", "platform_policies", inserted._id, {
        policy_type: type,
        version
      });
      return {
        data: {
          id: inserted._id.toString(),
          type,
          version,
          config,
          effectiveFrom: now
        }
      };
    },
    staff: async input => {
      const roleRows = await repository.collection("roles").find({
        code: {
          $in: MANAGED_STAFF_ROLES
        }
      }).exec();
      const privilegedRoles = await repository.collection("roles").find({
        code: {
          $in: ["MANAGER", "ADMIN"]
        }
      }).exec();
      const roleById = new Map(roleRows.map(role => [role._id.toString(), role]));
      const roleIds = roleRows.map(role => role._id);
      const privilegedRoleIds = privilegedRoles.map(role => role._id);
      const staff = await findPageRows(repository.collection("users"), {
        $and: [{
          $or: [{
            primary_role_id: {
              $in: roleIds
            }
          }, {
            additional_role_ids: {
              $in: roleIds
            }
          }]
        }, {
          $nor: [{
            primary_role_id: {
              $in: privilegedRoleIds
            }
          }, {
            additional_role_ids: {
              $in: privilegedRoleIds
            }
          }]
        }]
      }, input.query, {
        sort: {
          full_name: 1
        },
        projection: {
          full_name: 1,
          email: 1,
          phone: 1,
          account_status: 1,
          primary_role_id: 1,
          created_at: 1
        }
      });
      return {
        data: staff.map(user => ({
          id: user._id.toString(),
          name: user.full_name,
          email: user.email,
          phone: user.phone,
          department: user.department || "",
          jobTitle: user.job_title || "",
          workScope: user.work_scope || "",
          status: user.account_status,
          role: roleById.get(user.primary_role_id?.toString())?.code || "STAFF",
          createdAt: user.created_at
        })),
        pagination: staff.pagination
      };
    },
    createStaff: async input => {
      const {
        name,
        email,
        phone = "",
        password,
        role,
        department = "",
        jobTitle = "",
        workScope = ""
      } = input.body || {};
      const normalizedPhone = normalizeVietnamPhone(phone);
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120 || !isValidEmail(email) || normalizedPhone === null || typeof password !== "string" || password.length < 8 || password.length > 128 || !MANAGED_STAFF_ROLES.includes(role) || [department, jobTitle, workScope].some(value => typeof value !== "string" || value.length > 1000)) {
        throw httpError(400, "Thông tin nhân viên không hợp lệ; mật khẩu phải có ít nhất 8 ký tự.");
      }
      const normalizedEmail = email.trim().toLowerCase();
      const users = repository.collection("users");
      if (await users.findOne({
        email: normalizedEmail
      })) throw httpError(409, "Email đã được sử dụng.");
      const roleDoc = await repository.collection("roles").findOne({
        code: role
      });
      if (!roleDoc) throw httpError(400, "Không tìm thấy vai trò nhân viên.");
      const now = new Date();
      const inserted = await users.create({
        full_name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password_hash: await bcrypt.hash(password, 12),
        primary_role_id: roleDoc._id,
        additional_role_ids: [],
        account_status: "active",
        department: department.trim(),
        job_title: jobTitle.trim(),
        work_scope: workScope.trim(),
        created_at: now,
        updated_at: now
      });
      await writeAudit(input.actorId, "staff.create", "users", inserted._id, {
        role,
        department: department.trim(),
        job_title: jobTitle.trim()
      });
      return {
        data: {
          id: inserted._id.toString(),
          name: name.trim(),
          email: normalizedEmail,
          role,
          status: "active"
        }
      };
    },
    updateStaff: async input => {
      const id = toId(input.id);
      const {
        status,
        role
      } = input.body || {};
      const set = {
        updated_at: new Date()
      };
      if (status !== undefined) {
        if (!["active", "suspended"].includes(status)) throw httpError(400, "Trạng thái nhân sự không hợp lệ.");
        set.account_status = status;
      }
      if (role !== undefined) {
        if (!MANAGED_STAFF_ROLES.includes(role)) throw httpError(400, "Vai trò nhân sự không hợp lệ.");
        const roleDoc = await repository.collection("roles").findOne({
          code: role
        });
        if (!roleDoc) throw httpError(400, "Không tìm thấy vai trò được chọn.");
        set.primary_role_id = roleDoc._id;
      }
      const profileFields = {
        name: "full_name",
        phone: "phone",
        department: "department",
        jobTitle: "job_title",
        workScope: "work_scope"
      };
      for (const [input, field] of Object.entries(profileFields)) {
        if (input.body?.[input] === undefined) continue;
        const value = input.body[input];
        if (typeof value !== "string" || value.trim().length > (input === "workScope" ? 1000 : 120) || input === 'phone' && normalizeVietnamPhone(value) === null) throw httpError(400, "Thông tin hồ sơ nhân viên hoặc số điện thoại không hợp lệ.");
        set[field] = input === 'phone' ? normalizeVietnamPhone(value) : value.trim();
      }
      if (!id || Object.keys(set).length === 1) throw httpError(400, "Vui lòng cung cấp thông tin cần cập nhật.");
      const managedRoleRows = await repository.collection("roles").find({
        code: {
          $in: MANAGED_STAFF_ROLES
        }
      }).exec();
      const managedRoleIds = managedRoleRows.map(item => item._id);
      const privilegedRoles = await repository.collection("roles").find({
        code: {
          $in: ["MANAGER", "ADMIN"]
        }
      }).exec();
      const privilegedRoleIds = privilegedRoles.map(item => item._id);
      const result = await repository.collection("users").updateOne({
        $and: [{
          _id: id
        }, {
          $or: [{
            primary_role_id: {
              $in: managedRoleIds
            }
          }, {
            additional_role_ids: {
              $in: managedRoleIds
            }
          }]
        }, {
          $nor: [{
            primary_role_id: {
              $in: privilegedRoleIds
            }
          }, {
            additional_role_ids: {
              $in: privilegedRoleIds
            }
          }]
        }]
      }, {
        $set: set
      });
      if (!result.matchedCount) throw httpError(404, "Không tìm thấy nhân sự.");
      const {
        updated_at,
        primary_role_id,
        ...auditChanges
      } = set;
      await writeAudit(input.actorId, "staff.update", "users", id, {
        ...auditChanges,
        ...(role ? {
          role
        } : {})
      });
      return {
        data: {
          id: id.toString(),
          ...(status ? {
            status
          } : {}),
          ...(role ? {
            role
          } : {}),
          ...(auditChanges.full_name ? {
            name: auditChanges.full_name
          } : {})
        }
      };
    },
    contracts: async input => {
      const type = input.query.type === "rental" ? "rental" : "management";
      const collectionName = type === "rental" ? "rental_agreements" : "management_agreements";
      const filter = {};
      if (type === "management") {
        const approvedVehicles = await repository.vehicles.find({ onboarding_status: "approved" }, { projection: { _id: 1 } }).exec();
        filter.vehicle_id = { $in: approvedVehicles.map(vehicle => vehicle._id) };
      }
      if (input.query.status && input.query.status !== "all") filter.status = input.query.status;
      const rows = await findPageRows(repository.collection(collectionName), filter, input.query, {
        sort: {
          updated_at: -1,
          created_at: -1
        }
      });
      return {
        data: rows.map(item => ({
          id: item._id.toString(),
          type,
          number: item.agreement_number || item.contract_number,
          status: item.status,
          startDate: item.start_date || item.terms_snapshot?.start_at || null,
          endDate: item.end_date || item.terms_snapshot?.end_at || null,
          commissionRatePct: item.commission_rate_pct ?? null,
          terms: item.terms_snapshot || item.authorization_scope || {},
          signedAt: item.signed_at || item.signature_info?.owner_signed_at || null,
          managerReview: item.manager_review || null,
          amendments: item.amendments || [],
          updatedAt: item.updated_at || item.created_at
        })),
        pagination: rows.pagination
      };
    },
    updateContract: async input => {
      const id = toId(input.id);
      const type = input.type;
      const {
        action,
        reason,
        proposedTerms,
        note
      } = input.body || {};
      if (!id || !["management", "rental"].includes(type) || typeof reason !== "string" || !reason.trim() || reason.length > 1000) {
        throw httpError(400, "Thông tin cập nhật hợp đồng không hợp lệ.");
      }
      const collectionName = type === "rental" ? "rental_agreements" : "management_agreements";
      const contracts = repository.collection(collectionName);
      const contract = await contracts.findOne({
        _id: id
      });
      if (!contract) throw httpError(404, "Không tìm thấy hợp đồng.");
      const now = new Date();
      if (action === "amend") {
        if (!proposedTerms || typeof proposedTerms !== "object" || Array.isArray(proposedTerms) || Object.keys(proposedTerms).length > 30) {
          throw httpError(400, "Nội dung điều chỉnh hợp đồng không hợp lệ.");
        }
        const amendment = {
          proposed_terms: proposedTerms,
          reason: reason.trim(),
          status: "pending_signatures",
          created_by_manager_id: input.actorId,
          created_at: now
        };
        await contracts.updateOne({
          _id: id
        }, {
          $push: {
            amendments: amendment
          },
          $set: {
            updated_at: now
          }
        });
        await writeAudit(input.actorId, "contract.amendment_requested", collectionName, id, {
          reason: reason.trim(),
          proposed_terms: proposedTerms
        });
        return {
          data: {
            id: id.toString(),
            status: "pending_signatures",
            amendment
          }
        };
      }
      if (action === "terminate" && type === "management") {
        if (!["active", "pending"].includes(contract.status)) throw httpError(409, "Chỉ có thể chấm dứt hợp đồng quản lý đang hiệu lực.");
        await contracts.updateOne({
          _id: id,
          status: contract.status
        }, {
          $set: {
            status: "terminated",
            termination_info: {
              reason: reason.trim(),
              terminated_at: now,
              terminated_by_manager_id: input.actorId
            },
            updated_at: now
          }
        });
        await writeAudit(input.actorId, "contract.terminated", collectionName, id, {
          reason: reason.trim()
        });
        return {
          data: {
            id: id.toString(),
            status: "terminated"
          }
        };
      }
      if (action === "review" && typeof note === "string" && note.trim().length && note.length <= 1000) {
        const managerReview = {
          note: note.trim(),
          reason: reason.trim(),
          reviewed_by_manager_id: input.actorId,
          reviewed_at: now
        };
        await contracts.updateOne({
          _id: id
        }, {
          $set: {
            manager_review: managerReview,
            updated_at: now
          }
        });
        await writeAudit(input.actorId, "contract.reviewed", collectionName, id, {
          reason: reason.trim(),
          note: note.trim()
        });
        return {
          data: {
            id: id.toString(),
            managerReview
          }
        };
      }
      throw httpError(400, "Hành động hợp đồng không được hỗ trợ.");
    },
    inspectionReport: async input => {
      const filter = {};
      if (input.query.from || input.query.to) {
        filter.inspected_at = {};
        if (input.query.from && !Number.isNaN(Date.parse(input.query.from))) filter.inspected_at.$gte = new Date(input.query.from);
        if (input.query.to && !Number.isNaN(Date.parse(input.query.to))) {
          filter.inspected_at.$lte = new Date(input.query.to);
          if (input.query.to.length === 10) filter.inspected_at.$lte.setHours(23, 59, 59, 999);
        }
      }
      const data = await findPageRows(repository.collection("vehicle_inspections"), filter, input.query, {
        sort: {
          inspected_at: -1
        }
      });
      const vehicleIds = [...new Map(data.map(row => row.vehicle_id).filter(Boolean).map(id => [id.toString(), id])).values()];
      const vehicles = vehicleIds.length ? await repository.collection("vehicles").find({
        _id: {
          $in: vehicleIds
        }
      }).select({
        brand: 1,
        model: 1,
        license_plate: 1
      }).exec() : [];
      const map = new Map(vehicles.map(vehicle => [vehicle._id.toString(), vehicle]));
      return {
        data: data.map(row => ({
          id: row._id.toString(),
          inspectedAt: row.inspected_at,
          result: row.approval_status || row.result || row.inspection_result || row.status || row.recommendation || "completed",
          notes: row.decision_reason || row.notes || Object.values(row.condition_report || {}).filter(value => typeof value === "string").join(", "),
          vehicle: map.get(row.vehicle_id?.toString()) || null
        })),
        pagination: data.pagination
      };
    },
    financeReport: async input => {
      const from = input.query.from ? new Date(input.query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = input.query.to ? new Date(input.query.to) : new Date();
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
        throw httpError(400, "Khoảng ngày báo cáo không hợp lệ.");
      }
      if (input.query.to?.length === 10) to.setUTCHours(23, 59, 59, 999);
      const filter = {
        settled_at: {
          $gte: from,
          $lte: to
        },
        payout_status: "paid"
      };
      const rows = await findPageRows(repository.collection('owner_settlements'), filter, input.query, { projection: {
        settled_at: 1,
        gross_rental_revenue: 1,
        platform_commission: 1,
        net_owner_payout: 1
      }, sort: {
        settled_at: 1
      } });
      const [summary] = await repository.collection('owner_settlements').aggregate([
        { $match: filter },
        { $group: { _id: null, grossRentalRevenue: { $sum: '$gross_rental_revenue' }, platformCommission: { $sum: '$platform_commission' }, ownerPayout: { $sum: '$net_owner_payout' } } },
        { $project: { _id: 0 } },
      ]).exec();
      const totals = summary || { grossRentalRevenue: 0, platformCommission: 0, ownerPayout: 0 };
      return {
        data: {
          from,
          to,
          totals,
          settlements: rows.map(item => ({
            date: item.settled_at,
            grossRentalRevenue: item.gross_rental_revenue || 0,
            platformCommission: item.platform_commission || 0,
            ownerPayout: item.net_owner_payout || 0
          }))
        },
        pagination: rows.pagination
      };
    },
    operationsReport: async input => {
      const from = input.query.from ? new Date(input.query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = input.query.to ? new Date(input.query.to) : new Date();
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw httpError(400, "Khoảng ngày báo cáo không hợp lệ.");
      if (input.query.to?.length === 10) to.setHours(23, 59, 59, 999);
      const [bookings, incidents, fleetSize] = await Promise.all([repository.collection("bookings").find({
        start_at: {
          $gte: from,
          $lte: to
        }
      }).select({
        status: 1,
        vehicle_id: 1,
        rental_fee_amount: 1
      }).exec(), repository.collection("incident_cases").find({
        created_at: {
          $gte: from,
          $lte: to
        }
      }).select({
        status: 1
      }).exec(), repository.collection("vehicles").countDocuments({
        onboarding_status: "approved"
      })]);
      const byStatus = bookings.reduce((result, item) => {
        const key = item.status || "unknown";
        result[key] = (result[key] || 0) + 1;
        return result;
      }, {});
      const activeStatuses = new Set(["confirmed", "ongoing", "completed"]);
      const activeBookings = bookings.filter(item => activeStatuses.has(item.status));
      const utilizedVehicles = new Set(activeBookings.map(item => item.vehicle_id?.toString()).filter(Boolean)).size;
      const openIncidents = incidents.filter(item => OPEN_INCIDENT_STATUSES.includes(item.status)).length;
      const report = {
        from,
        to,
        bookings: {
          total: bookings.length,
          byStatus,
          rentalRevenue: bookings.reduce((sum, item) => sum + (Number(item.rental_fee_amount) || 0), 0)
        },
        fleet: {
          approvedVehicles: fleetSize,
          vehiclesWithBookings: utilizedVehicles,
          utilizationPct: fleetSize ? Math.round(utilizedVehicles / fleetSize * 1000) / 10 : 0
        },
        incidents: {
          total: incidents.length,
          open: openIncidents,
          resolved: incidents.length - openIncidents
        }
      };
      return {
        data: report
      };
    }
  };
}
