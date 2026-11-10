import { ObjectId } from 'mongodb';
import { httpError } from '../../utils/http-error.js';
import { parseOperationListQuery, parseOverdueAction } from '../../modules/operation/operation.validator.js';
import {
  escapeOperationSearch,
  operationPageInfo,
  toOperationId,
} from '../../modules/operation/operation.context.js';

export function createOperationOverdueService(repository, context) {
  const { actorId, audit, bookingRows } = context;

  return {
    async listOverdue(query) {
      const parsed = parseOperationListQuery(query, {
        statuses: ['ongoing'],
        defaultStatus: 'ongoing',
      });
      const now = new Date();
      const filter = {
        status: 'ongoing',
        end_at: { $lt: now },
        actual_end_at: null,
      };
      if (parsed.q) {
        filter.booking_code = {
          $regex: escapeOperationSearch(parsed.q),
          $options: 'i',
        };
      }
      const [rows, total] = await Promise.all([
        repository.findMany('bookings', filter, {
          ...parsed,
          sortBy: { end_at: 1, _id: 1 },
        }),
        repository.count('bookings', filter),
      ]);
      const mapped = await bookingRows(rows);
      return {
        data: mapped.map((row) => {
          const booking = rows.find((item) => item._id.toString() === row.id);
          const overdueHours = Math.max(1, Math.ceil((now - new Date(row.endAt)) / 3600000));
          return {
            ...row,
            overdueHours,
            lateFeeEstimate: overdueHours * row.lateFeePerHour,
            handledAt: booking?.operation_overdue_handled_at || null,
          };
        }),
        pagination: operationPageInfo(parsed.page, parsed.limit, total),
      };
    },

    async overdueAction(request, idValue, body) {
      const id = toOperationId(idValue);
      const action = parseOverdueAction(body);
      const now = new Date();
      const booking = await repository.findById('bookings', id);
      if (
        !booking ||
        booking.status !== 'ongoing' ||
        !booking.end_at ||
        booking.end_at >= now ||
        booking.actual_end_at
      ) {
        throw httpError(409, 'Booking này hiện không quá hạn.');
      }

      if (action.action === 'remind') {
        await repository.insertOne('notifications', {
          _id: new ObjectId(),
          recipient_user_id: booking.renter_id,
          notification_type: 'overdue_rental_reminder',
          title: 'Nhắc trả xe quá hạn',
          content: action.note || `Booking ${booking.booking_code} đã quá thời gian trả xe.`,
          related_entity_type: 'booking',
          related_entity_id: id,
          delivery_channels: {
            in_app: { status: 'pending' },
            email: { status: 'not_requested' },
          },
          is_read: false,
          created_at: now,
          read_at: null,
        });
      } else {
        await repository.updateOne(
          'bookings',
          { _id: id, status: 'ongoing' },
          {
            $set: {
              operation_overdue_handled_at: now,
              operation_overdue_handled_by: actorId(request),
              operation_overdue_note: action.note || '',
              updated_at: now,
            },
          },
        );
      }
      await audit(request, `overdue.${action.action}`, 'bookings', id, { note: action.note || '' });
      return {
        data: {
          id: id.toString(),
          action: action.action,
          handledAt: action.action === 'handled' ? now : null,
        },
      };
    },
  };
}
