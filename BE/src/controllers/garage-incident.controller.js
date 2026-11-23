import { Types } from 'mongoose';
import { objectId } from '../utils/http-error.js';
import { parseGarageIncident } from '../validators/garage-incident.validator.js';

export function createGarageIncidentController(service) {
  return {
    get: async (request, response) => response.json({ data: await service.get(new Types.ObjectId(objectId(request.params.id)), request.actor) }),
    create: async (request, response) => response.status(201).json(await service.create(parseGarageIncident(request.body), request.actor)),
  };
}
