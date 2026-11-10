import { httpError } from '../../utils/http-error.js';
import {
  parseListingReview,
  parseListingUpdate,
  parseOperationListQuery,
} from '../../modules/operation/operation.validator.js';
import {
  escapeOperationSearch,
  operationPageInfo,
  toOperationId,
} from '../../modules/operation/operation.context.js';

export function createOperationListingService(repository, context) {
  const { actorId, audit, joinUsers } = context;

  return {
    async listListings(query) {
      const parsed = parseOperationListQuery(query, {
        statuses: ['draft', 'pending_review', 'published', 'suspended', 'archived', 'rejected'],
      });
      const filter = parsed.status === 'all' ? {} : { status: parsed.status };
      if (parsed.q) {
        filter.$or = [
          { title: { $regex: escapeOperationSearch(parsed.q), $options: 'i' } },
          { description: { $regex: escapeOperationSearch(parsed.q), $options: 'i' } },
        ];
      }

      const [rows, total] = await Promise.all([
        repository.findMany('vehicle_listings', filter, {
          ...parsed,
          sortBy: { updated_at: -1, _id: -1 },
        }),
        repository.count('vehicle_listings', filter),
      ]);
      const vehicleIds = [...new Map(
        rows.map((row) => row.vehicle_id).filter(Boolean)
          .map((id) => [id.toString(), id]),
      ).values()];
      const vehicles = vehicleIds.length
        ? await repository.collection('vehicles')
          .find({ _id: { $in: vehicleIds } })
          .project({ brand: 1, model: 1, license_plate: 1, manufacture_year: 1, owner_id: 1 })
          .toArray()
        : [];
      const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle._id.toString(), vehicle]));
      const owners = await joinUsers(vehicles.map((vehicle) => vehicle.owner_id));

      return {
        data: rows.map((row) => {
          const vehicle = vehicleMap.get(row.vehicle_id?.toString());
          return {
            id: row._id.toString(),
            title: row.title,
            description: row.description,
            status: row.status,
            dailyPrice: row.daily_price,
            securityDepositAmount: row.security_deposit_amount,
            pickupLocation: row.pickup_location,
            photos: row.photos || [],
            vehicle: vehicle
              ? {
                ...vehicle,
                id: vehicle._id.toString(),
                owner: owners.get(vehicle.owner_id?.toString()) || null,
              }
              : null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }),
        pagination: operationPageInfo(parsed.page, parsed.limit, total),
      };
    },

    async getListing(idValue) {
      const row = await repository.findById('vehicle_listings', toOperationId(idValue));
      if (!row) throw httpError(404, 'Không tìm thấy tin xe.');
      const vehicle = row.vehicle_id
        ? await repository.findById('vehicles', row.vehicle_id)
        : null;
      const owners = await joinUsers(vehicle?.owner_id ? [vehicle.owner_id] : []);
      return {
        data: {
          id: row._id.toString(),
          title: row.title,
          description: row.description,
          status: row.status,
          dailyPrice: row.daily_price,
          securityDepositAmount: row.security_deposit_amount,
          pickupLocation: row.pickup_location,
          photos: row.photos || [],
          mileagePolicy: row.mileage_policy || {},
          rentalPolicy: row.rental_policy_snapshot || {},
          vehicle: vehicle
            ? {
              id: vehicle._id.toString(),
              brand: vehicle.brand,
              model: vehicle.model,
              licensePlate: vehicle.license_plate,
              year: vehicle.manufacture_year,
              owner: owners.get(vehicle.owner_id?.toString()) || null,
            }
            : null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      };
    },

    async updateListing(request, idValue, body) {
      const id = toOperationId(idValue);
      const changes = parseListingUpdate(body);
      const now = new Date();
      const result = await repository.updateOne(
        'vehicle_listings',
        { _id: id },
        {
          $set: {
            ...changes,
            updated_at: now,
            updated_by_operation_staff_id: actorId(request),
          },
        },
      );
      if (!result.matchedCount) throw httpError(404, 'Không tìm thấy tin xe.');
      await audit(request, 'listing.update', 'vehicle_listings', id, Object.keys(changes));
      return {
        data: {
          id: id.toString(),
          ...(changes.title !== undefined ? { title: changes.title } : {}),
          ...(changes.description !== undefined ? { description: changes.description } : {}),
          ...(changes.daily_price !== undefined ? { dailyPrice: changes.daily_price } : {}),
          ...(changes.security_deposit_amount !== undefined
            ? { securityDepositAmount: changes.security_deposit_amount }
            : {}),
          ...(changes.pickup_location !== undefined ? { pickupLocation: changes.pickup_location } : {}),
          updatedAt: now,
        },
      };
    },

    async reviewListing(request, idValue, body) {
      const id = toOperationId(idValue);
      const { action, reason } = parseListingReview(body);
      const transitions = {
        approve: ['published', ['draft', 'pending_review', 'suspended']],
        reject: ['archived', ['draft', 'pending_review', 'published']],
        activate: ['published', ['suspended', 'archived']],
        deactivate: ['suspended', ['published']],
      };
      const [nextStatus, expectedStatuses] = transitions[action];
      const now = new Date();
      const result = await repository.updateOne(
        'vehicle_listings',
        { _id: id, status: { $in: expectedStatuses } },
        {
          $set: {
            status: nextStatus,
            updated_at: now,
            handled_by: actorId(request),
            handled_at: now,
            operation_review_note: reason,
          },
        },
      );
      if (!result.modifiedCount) {
        throw httpError(409, 'Trạng thái tin xe không cho phép thao tác này.');
      }
      await audit(request, `listing.${action}`, 'vehicle_listings', id, { status: nextStatus, reason });
      return { data: { id: id.toString(), status: nextStatus } };
    },
  };
}
