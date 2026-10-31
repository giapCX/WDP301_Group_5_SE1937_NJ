import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { requireGarageStaff } from '../middleware/garage-auth.js';
import { createVehicleIntakeService } from '../services/vehicle-intakes.js';
import {
  parseConfirmation,
  parseIntakeDraft,
  parseIntakeList,
} from '../validators/vehicle-intakes.js';
import { httpError, objectId } from '../utils/http-error.js';

export function createGarageIntakesRouter(database, authConfig) {
  const router = Router();
  const service = createVehicleIntakeService(database);
  router.use(requireGarageStaff(database, authConfig));
  router.get('/intake-vehicles', async (request, response) => {
    const query = parseIntakeList(request.query);
    if (query.status !== 'all')
      throw httpError(
        400,
        'Danh sách xe chờ tiếp nhận không lọc theo trạng thái biên bản.',
      );
    response.json(await service.list(query, true));
  });
  router.get(
    '/vehicles/:vehicleId/intake-eligibility',
    async (request, response) => {
      const vehicleId = new ObjectId(
        objectId(request.params.vehicleId, 'vehicleId'),
      );
      const agreementId = new ObjectId(
        objectId(request.query.managementAgreementId, 'managementAgreementId'),
      );
      response.json({
        data: await service.eligibility(vehicleId, agreementId),
      });
    },
  );
  router.get('/intakes', async (request, response) =>
    response.json(await service.list(parseIntakeList(request.query))),
  );
  router.post('/intakes', async (request, response) =>
    response
      .status(201)
      .json({
        data: await service.create(
          parseIntakeDraft(request.body, true),
          request.actor,
        ),
      }),
  );
  router.get('/intakes/:id', async (request, response) =>
    response.json({
      data: await service.get(new ObjectId(objectId(request.params.id))),
    }),
  );
  router.patch('/intakes/:id', async (request, response) =>
    response.json({
      data: await service.update(
        new ObjectId(objectId(request.params.id)),
        parseIntakeDraft(request.body),
        request.actor,
      ),
    }),
  );
  router.post('/intakes/:id/confirm', async (request, response) => {
    const { version } = parseConfirmation(request.body);
    response.json(
      await service.confirm(
        new ObjectId(objectId(request.params.id)),
        version,
        request.actor,
      ),
    );
  });
  return router;
}
