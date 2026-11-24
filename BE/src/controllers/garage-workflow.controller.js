const service = require('../services/garage-workflow.service');

async function tasks(req, res, next) {
  try { return res.set('Cache-Control', 'no-store').json({ success: true, data: await service.tasks(req.query) }); }
  catch (error) { return next(error); }
}
async function inspection(req, res, next) {
  try { return res.status(201).json({ success: true, data: await service.inspectAndHandover(req.body || {}, req.user.user_id) }); }
  catch (error) { return next(error); }
}
async function maintenance(req, res, next) {
  try { return res.json({ success: true, data: await service.updateMaintenance(req.params.id, req.body || {}, req.user.user_id) }); }
  catch (error) { return next(error); }
}
module.exports = { tasks, inspection, maintenance };
