const { Router } = require('express');
const controller = require('../controllers/additional-charge.controller');
const requireOperator = require('../middleware/require-operator.middleware');
const requireRenter = require('../middleware/require-renter.middleware');

const operatorBookingRoutes = Router();
operatorBookingRoutes.use(requireOperator);
operatorBookingRoutes.get('/:id/additional-charges', controller.list());
operatorBookingRoutes.post('/:id/additional-charges', controller.mutate('create'));
operatorBookingRoutes.get('/:id/additional-charges/:chargeId', controller.detail());
operatorBookingRoutes.patch(
  '/:id/additional-charges/:chargeId',
  controller.mutate('update'),
);
operatorBookingRoutes.patch(
  '/:id/additional-charges/:chargeId/confirm',
  controller.mutate('confirm'),
);
operatorBookingRoutes.patch(
  '/:id/additional-charges/:chargeId/cancel',
  controller.mutate('cancel'),
);
operatorBookingRoutes.patch(
  '/:id/additional-charges/:chargeId/resolve-dispute',
  controller.mutate('resolve'),
);

const operatorChargeRoutes = Router();
operatorChargeRoutes.get('/', requireOperator, controller.list());

const renterBookingRoutes = Router();
renterBookingRoutes.use(requireRenter);
renterBookingRoutes.get('/:id/additional-charges', controller.list(true));
renterBookingRoutes.get('/:id/additional-charges/:chargeId', controller.detail(true));
renterBookingRoutes.post(
  '/:id/additional-charges/:chargeId/dispute',
  controller.mutate('dispute'),
);

module.exports = { operatorBookingRoutes, operatorChargeRoutes, renterBookingRoutes };
