const { Router } = require('express');
const controller = require('../controllers/additional-charge.controller');
const requireOperator = require('../middleware/require-operator.middleware');
const requireRenter = require('../middleware/require-renter.middleware');
const { requireRolePermission } = require('../middleware/require-management-role.middleware');

const operatorBookingRoutes = Router();
operatorBookingRoutes.use(requireOperator);
operatorBookingRoutes.get('/:id/additional-charges', requireRolePermission('booking.read.all'), controller.list());
operatorBookingRoutes.post('/:id/additional-charges', requireRolePermission('booking.review'), controller.mutate('create'));
operatorBookingRoutes.get('/:id/additional-charges/:chargeId', requireRolePermission('booking.read.all'), controller.detail());
operatorBookingRoutes.patch(
  '/:id/additional-charges/:chargeId',
  requireRolePermission('booking.review'),
  controller.mutate('update'),
);
operatorBookingRoutes.patch(
  '/:id/additional-charges/:chargeId/confirm',
  requireRolePermission('booking.review'),
  controller.mutate('confirm'),
);
operatorBookingRoutes.patch(
  '/:id/additional-charges/:chargeId/cancel',
  requireRolePermission('booking.review'),
  controller.mutate('cancel'),
);
operatorBookingRoutes.patch(
  '/:id/additional-charges/:chargeId/resolve-dispute',
  requireRolePermission('booking.review'),
  controller.mutate('resolve'),
);

const operatorChargeRoutes = Router();
operatorChargeRoutes.get('/', requireOperator, requireRolePermission('booking.read.all'), controller.list());

const renterBookingRoutes = Router();
renterBookingRoutes.use(requireRenter, requireRolePermission('booking.read.own'));
renterBookingRoutes.get('/:id/additional-charges', controller.list(true));
renterBookingRoutes.get('/:id/additional-charges/:chargeId', controller.detail(true));
renterBookingRoutes.post(
  '/:id/additional-charges/:chargeId/dispute',
  controller.mutate('dispute'),
);

module.exports = { operatorBookingRoutes, operatorChargeRoutes, renterBookingRoutes };
