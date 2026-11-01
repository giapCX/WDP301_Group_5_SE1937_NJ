import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { requireGarageStaff } from '../middleware/garage-auth.js';
import { createVehicleInspectionService } from '../services/vehicle-inspections.js';
import {
  parseInspectionDraft,
  parseInspectionList,
  parseInspectionSubmission,
} from '../validators/vehicle-inspections.js';
import { objectId } from '../utils/http-error.js';

export function createGarageInspectionsRouter(database, authConfig) {
  const router = Router();
  const service = createVehicleInspectionService(database);
  router.use(
    [
      '/inspections',
      '/inspection-vehicles',
      '/vehicles/:vehicleId/inspection-eligibility',
    ],
    requireGarageStaff(database, authConfig, 'vehicle.inspect'),
  );
  router.get('/inspection-vehicles', async (request, response) =>
    response.json(
      await service.list(
        parseInspectionList(request.query, true),
        request.actor,
        true,
      ),
    ),
  );
  router.get(
    '/vehicles/:vehicleId/inspection-eligibility',
    async (request, response) =>
      response.json({
        data: await service.eligibility(
          new ObjectId(objectId(request.params.vehicleId, 'vehicleId')),
        ),
      }),
  );
  router.get('/inspections', async (request, response) =>
    response.json(
      await service.list(parseInspectionList(request.query), request.actor),
    ),
  );
  router.post('/inspections', async (request, response) =>
    response
      .status(201)
      .json({
        data: await service.create(
          parseInspectionDraft(request.body, true),
          request.actor,
        ),
      }),
  );
  router.get('/inspections/:id', async (request, response) =>
    response.json({
      data: await service.get(new ObjectId(objectId(request.params.id))),
    }),
  );
  router.patch('/inspections/:id', async (request, response) =>
    response.json({
      data: await service.update(
        new ObjectId(objectId(request.params.id)),
        parseInspectionDraft(request.body),
        request.actor,
      ),
    }),
  );
  router.post('/inspections/:id/submit', async (request, response) =>
    response.json(
      await service.submit(
        new ObjectId(objectId(request.params.id)),
        parseInspectionSubmission(request.body),
        request.actor,
      ),
    ),
  );
  return router;
}
