const service = require('../services/garage-workflow.service');
const taskService = require('../services/garage-task.service');
const handovers = require('../services/vehicle-handover.service');
const maintenanceService = require('../services/garage-maintenance.service');

async function tasks(req, res) {
  const data = await taskService.tasks(req.query);
  return res.set('Cache-Control', 'no-store').json({ success: true, data });
}

async function taskDetail(req, res) {
  const data = await taskService.taskDetails(req.params.taskId, req.params.vehicleId);
  return res.set('Cache-Control', 'no-store').json({ success: true, data });
}
async function createHandover(req, res, next) {
  try { return res.status(201).json({ success: true, data: await handovers.create(req.body || {}, req.user.user_id) }); }
  catch (error) { return next(error); }
}
async function recheckHandover(req, res, next) {
  try { return res.json({ success: true, data: await handovers.recheck(req.params.id, req.user.user_id) }); }
  catch (error) { return next(error); }
}
async function inspection(req, res, next) {
  try { return res.status(201).json({ success: true, data: await service.recordInspection(req.body || {}, req.user.user_id) }); }
  catch (error) { return next(error); }
}
async function inspectionPhoto(req, res, next) {
  try {
    if (req.params.bookingId) await handovers.assertDriverPhoto(req.params.bookingId, req.params.id, req.user.user_id);
    const photo = await service.inspectionPhoto(req.params.id, req.params.index);
    return res
      .set('Cache-Control', 'private, no-store')
      .set('X-Content-Type-Options', 'nosniff')
      .type(photo.content_type)
      .send(Buffer.from(photo.data));
  } catch (error) {
    return next(error);
  }
}
async function maintenance(req, res, next) {
  try { return res.json({ success: true, data: await maintenanceService.updateMaintenance(req.params.id, req.body || {}, req.user.user_id) }); }
  catch (error) { return next(error); }
}
async function repair(req, res, next) {
  try { return res.json({ success: true, data: await maintenanceService.recordRepair(req.params.id, req.body || {}, req.user.user_id) }); }
  catch (error) { return next(error); }
}
module.exports = { tasks, taskDetail, createHandover, recheckHandover, inspection, inspectionPhoto, maintenance, repair };
