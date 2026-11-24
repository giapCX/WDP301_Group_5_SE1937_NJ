const service = require('../services/garage-workflow.service');

async function tasks(req, res, next) {
  try { return res.set('Cache-Control', 'no-store').json({ success: true, data: await service.tasks(req.query) }); }
  catch (error) { return next(error); }
}
async function inspection(req, res, next) {
  try { return res.status(201).json({ success: true, data: await service.inspectAndHandover(req.body || {}, req.user.user_id) }); }
  catch (error) { return next(error); }
}
async function inspectionPhoto(req, res, next) {
  try {
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
  try { return res.json({ success: true, data: await service.updateMaintenance(req.params.id, req.body || {}, req.user.user_id) }); }
  catch (error) { return next(error); }
}
module.exports = { tasks, inspection, inspectionPhoto, maintenance };
