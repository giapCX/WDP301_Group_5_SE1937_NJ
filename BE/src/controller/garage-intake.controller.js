import { Types } from 'mongoose';
import { parseConfirmation, parseIntakeDraft, parseIntakeList } from '../validators/garage-intake.validator.js';
import { httpError, objectId } from '../utils/http-error.js';

const { ObjectId } = Types;

export function createVehicleIntakeController(service) {
  return {
    candidates: async (request, response) => {
      const query = parseIntakeList(request.query);
      if (query.status !== 'all')
        throw httpError(400, 'Danh sách xe chờ tiếp nhận không lọc theo trạng thái biên bản.');
      response.json(await service.list(query, true));
    },
    eligibility: async (request, response) => {
      const vehicleId = new ObjectId(objectId(request.params.vehicleId, 'vehicleId'));
      const agreementId = new ObjectId(objectId(request.query.managementAgreementId, 'managementAgreementId'));
      response.json({ data: await service.eligibility(vehicleId, agreementId) });
    },
    list: async (request, response) => response.json(await service.list(parseIntakeList(request.query))),
    create: async (request, response) => response.status(201).json({
      data: await service.create(parseIntakeDraft(request.body, true), request.actor),
    }),
    get: async (request, response) => response.json({
      data: await service.get(new ObjectId(objectId(request.params.id))),
    }),
    update: async (request, response) => response.json({
      data: await service.update(new ObjectId(objectId(request.params.id)), parseIntakeDraft(request.body), request.actor),
    }),
    confirm: async (request, response) => {
      const { version } = parseConfirmation(request.body);
      response.json(await service.confirm(new ObjectId(objectId(request.params.id)), version, request.actor));
    },
  };
}
