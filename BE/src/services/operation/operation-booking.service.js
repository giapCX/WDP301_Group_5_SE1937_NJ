import { httpError } from '../../utils/http-error.js';
import { parseBookingDecision, parseOperationListQuery } from '../../modules/operation/operation.validator.js';
import {
  escapeOperationSearch,
  operationPageInfo,
  toOperationId,
} from '../../modules/operation/operation.context.js';

export function createOperationBookingService(repository, context) {
  const { actorId, audit, bookingRows } = context;

  return {
    async listBookings(query) {
      const parsed = parseOperationListQuery(query, {
        statuses: ['pending', 'confirmed', 'ongoing', 'completed', 'cancelled', 'rejected'],
      });
      const filter = parsed.status === 'all' ? {} : { status: parsed.status };
      if (parsed.q) {
        filter.$or = [
          { booking_code: { $regex: escapeOperationSearch(parsed.q), $options: 'i' } },
          { status: { $regex: escapeOperationSearch(parsed.q), $options: 'i' } },
        ];
      }
      const sortBy = parsed.sortBy.start_at
        ? parsed.sortBy
        : { created_at: parsed.sortBy.created_at, _id: parsed.sortBy._id };
      const [rows, total] = await Promise.all([
        repository.findMany('bookings', filter, { ...parsed, sortBy }),
        repository.count('bookings', filter),
      ]);
      return {
        data: await bookingRows(rows),
        pagination: operationPageInfo(parsed.page, parsed.limit, total),
      };
    },

    async getBooking(id) {
      const booking = await repository.findById('bookings', toOperationId(id));
      if (!booking) throw httpError(404, 'Không tìm thấy booking.');
      return { data: (await bookingRows([booking]))[0] };
    },

    async decideBooking(request, idValue, body) {
      const id = toOperationId(idValue);
      const { action, reason } = parseBookingDecision(body);
      const now = new Date();
      const status = action === 'approve' ? 'confirmed' : 'rejected';
      const decision = action === 'approve' ? 'approved' : 'rejected';
      const result = await repository.updateOne(
        'bookings',
        { _id: id, status: 'pending' },
        {
          $set: {
            status,
            updated_at: now,
            'review_info.required': true,
            'review_info.decision': decision,
            'review_info.reviewed_by': actorId(request),
            'review_info.reviewed_at': now,
            'review_info.reason': reason,
          },
          $push: {
            status_history: {
              from: 'pending',
              to: status,
              at: now,
              actor: actorId(request),
              reason,
            },
          },
        },
      );
      if (!result.modifiedCount) {
        throw httpError(409, 'Booking không còn ở trạng thái chờ xử lý.');
      }
      await audit(request, `booking.${action}`, 'bookings', id, { status, reason });
      return { data: { id: id.toString(), status, decision } };
    },
  };
}
