import { Types } from 'mongoose';
import { objectId } from '../utils/http-error.js';
import { parseHandover, parseHandoverConfirmation, handoverType } from '../validators/garage-handover.validator.js';

const id = (value) => new Types.ObjectId(objectId(value));
export function createGarageHandoverController(service) {
  return {
    eligibility: async (request, response) => response.json({ data: await service.context(id(request.params.bookingId), handoverType(request.query.type)) }),
    get: async (request, response) => response.json({ data: await service.get(id(request.params.id)) }),
    create: async (request, response) => response.status(201).json({ data: await service.create(parseHandover(request.body, true), request.actor) }),
    update: async (request, response) => response.json({ data: await service.update(id(request.params.id), parseHandover(request.body), request.actor) }),
    confirm: async (request, response) => response.json(await service.confirm(id(request.params.id), parseHandoverConfirmation(request.body), request.actor)),
  };
}
