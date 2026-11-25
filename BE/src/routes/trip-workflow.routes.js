const { Router } = require('express');
const controller = require('../controllers/trip-workflow.controller');
const { inspectionPhoto } = require('../controllers/garage-workflow.controller');
const { photo: damagePhoto } = require('../controllers/garage-damage.controller');
const requireOperator = require('../middleware/require-operator.middleware');
const requireDriver = require('../middleware/require-driver.middleware');
const HttpError = require('../utils/http-error');

const operator = Router();
operator.use(requireOperator);
operator.get('/', controller.dispatch);
operator.post('/:id/assign', controller.assign);
operator.post('/:id/replace-vehicle', controller.replaceVehicle);
operator.post('/:id/reassign-return', controller.reassignReturn);
operator.post('/:id/incidents/:incidentId/resolve', controller.resolve);
operator.get('/:bookingId/incidents/:incidentId/damage-photos/:index', damagePhoto);

const driver = Router();
driver.use(requireDriver);
driver.get('/', controller.trips);
driver.get('/:bookingId/handover/:id/photos/:index', inspectionPhoto);
driver.post('/:id/incident', controller.incident);
driver.post('/:id/:action', (req, res, next) => {
  if (!['accept', 'reject', 'vehicle_received', 'vehicle_declined', 'update', 'report', 'vehicle_returned'].includes(req.params.action))
    return next(new HttpError(404, 'Không tìm thấy thao tác'));
  return controller.driverAction(req, res, next);
});

module.exports = { operator, driver };
