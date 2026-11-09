import { Types } from 'mongoose';
import { parseInspectionDraft, parseInspectionList, parseInspectionSubmission } from '../validators/garage-inspection.validator.js';
import { objectId } from '../utils/http-error.js';

const { ObjectId } = Types;

export function createVehicleInspectionController(service) {
  return {
    candidates: async (request, response) => response.json(
      await service.list(parseInspectionList(request.query, true), request.actor, true),
    ),
    eligibility: async (request, response) => response.json({
      data: await service.eligibility(new ObjectId(objectId(request.params.vehicleId, 'vehicleId'))),
    }),
    list: async (request, response) => response.json(
      await service.list(parseInspectionList(request.query), request.actor),
    ),
    create: async (request, response) => response.status(201).json({
      data: await service.create(parseInspectionDraft(request.body, true), request.actor),
    }),
    get: async (request, response) => response.json({
      data: await service.get(new ObjectId(objectId(request.params.id))),
    }),
    update: async (request, response) => response.json({
      data: await service.update(new ObjectId(objectId(request.params.id)), parseInspectionDraft(request.body), request.actor),
    }),
    submit: async (request, response) => response.json(
      await service.submit(new ObjectId(objectId(request.params.id)), parseInspectionSubmission(request.body), request.actor),
    ),
  };
}
