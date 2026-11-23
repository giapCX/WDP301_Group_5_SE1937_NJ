import { findPageRows } from "../utils/pagination.js";
import { escapeRegExp } from '../utils/regex.js';
import { garageTransaction } from '../utils/garage-transaction.js';
import { BOOKING_PAYMENT_WINDOW_MS, BOOKING_REVIEW_WINDOW_MS, BOOKING_REVIEWER_ROLE, bookingHoldExpression, isBookingHoldExpired } from '../utils/booking-hold.js';
import { httpError } from '../utils/http-error.js';
import { parseManagerBookingDecision, parseManagerListingReview, parseManagerListingUpdate } from '../validators/manager.validator.js';
import { Types } from 'mongoose';

const { ObjectId } = Types;
const toId = value => ObjectId.isValid(value) ? new ObjectId(value) : null;
const MINIMUM_PICKUP_NOTICE_MS = 2 * 60 * 60 * 1000;

export function createRentalOperationsService(repository) {
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
    async bookings(input) {
      const { q = '', status = 'pending' } = input.query;
      if (typeof q !== 'string' || q.length > 100 || !['pending', 'trips', 'all'].includes(status)) throw httpError(400, 'Bộ lọc booking không hợp lệ.');
      await expireStaleBookings();
      const filter = status === 'pending'
        ? { status, 'review_info.required': { $ne: false },
          'review_info.reviewer_role': input.operatorQueue ? BOOKING_REVIEWER_ROLE : { $ne: BOOKING_REVIEWER_ROLE } }
        : status === 'trips' ? { status: { $in: ['confirmed', 'ongoing', 'completed'] } } : {};
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
          actualStartAt: row.actual_start_at,
          actualEndAt: row.actual_end_at,
          overdue: row.status === 'ongoing' && !row.actual_end_at && row.end_at < new Date(),
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
      const decide = async (session) => {
        const options = session ? { session } : {};
        const booking = await repository.collection('bookings').findOne({ _id: id }, options);
        if (!booking || booking.status !== 'pending' || isBookingHoldExpired(booking, now)) throw httpError(409, 'Booking không còn ở trạng thái chờ xử lý.');
        if (booking.review_info?.required === false) throw httpError(409, 'Yêu cầu này chuyển sang thanh toán sau khi hợp đồng đủ chữ ký.');
        if (Boolean(input.operatorQueue) !== (booking.review_info?.reviewer_role === BOOKING_REVIEWER_ROLE)) {
          throw httpError(409, 'Yêu cầu thuê thuộc hàng đợi của vai trò khác.');
        }
        if (action === 'approve' && (!(booking.start_at instanceof Date) || booking.start_at.getTime() < now.getTime() + MINIMUM_PICKUP_NOTICE_MS)) {
          throw httpError(409, 'Thời gian nhận xe phải còn tối thiểu 2 giờ; yêu cầu booking lịch mới.');
        }
        if (input.operatorQueue && action === 'approve') {
          const listing = await repository.collection('vehicle_listings').findOne({
            _id: booking.listing_id, vehicle_id: booking.vehicle_id, status: 'published',
          }, options);
          if (!listing) throw httpError(409, 'Tin xe không còn được xuất bản.');
          const agreement = await repository.collection('rental_agreements').findOne({
            booking_id: id, 'contract_document.hash': { $exists: true }, status: 'pending_signatures',
          }, options);
          if (!agreement) throw httpError(409, 'Yêu cầu thuê thiếu bản nháp hợp đồng.');
          const lockedVehicle = await repository.collection('vehicles').updateOne({
            _id: booking.vehicle_id, onboarding_status: 'approved', physical_status: 'at_garage',
          }, { $inc: { renter_calendar_version: 1 } }, options);
          if (lockedVehicle.matchedCount !== 1) throw httpError(409, 'Xe chưa sẵn sàng tại gara.');
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
        }, options);
        if (!result.modifiedCount) throw httpError(409, 'Booking không còn ở trạng thái chờ xử lý.');
        await repository.collection('audit_logs').create({
          actor_user_id: input.actorId,
          action: `booking.${action}`,
          entity_type: 'bookings',
          entity_id: id,
          sanitized_changes: { status, reason },
          created_at: now,
        }, options);
        return { data: { id: id.toString(), status, decision, ...(paymentDeadline ? { paymentDeadline } : {}) } };
      };
      return input.operatorQueue ? garageTransaction(repository, decide) : decide();
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
  };
}
