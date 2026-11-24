const service = require('../services/trip-workflow.service');
async function run(task, req, res, next) {
  try { return res.set('Cache-Control', 'no-store').json({ success: true, data: await task() }); }
  catch (error) { return next(error); }
}
const dispatch = (req, res, next) => run(() => service.dispatchData(), req, res, next);
const assign = (req, res, next) => run(() => service.assign(req.params.id, req.body || {}, req.user.user_id), req, res, next);
const trips = (req, res, next) => run(() => service.driverTrips(req.user.user_id), req, res, next);
const driverAction = (req, res, next) => run(() => service.mutateDriver(req.params.id, req.user.user_id, req.params.action, req.body || {}), req, res, next);
const incident = (req, res, next) => run(() => service.reportIncident(req.params.id, req.user.user_id, req.body || {}), req, res, next);
const resolve = (req, res, next) => run(() => service.resolveIncident(req.params.id, req.params.incidentId, req.user.user_id, req.body?.resolution_note), req, res, next);
const replaceVehicle = (req, res, next) => run(() => service.replaceVehicle(req.params.id, req.body?.vehicle_id, req.user.user_id), req, res, next);
const reassignReturn = (req, res, next) => run(() => service.reassignReturn(req.params.id, req.body?.driver_id, req.user.user_id), req, res, next);
module.exports = { dispatch, assign, trips, driverAction, incident, resolve, replaceVehicle, reassignReturn };
