const service = require('../services/garage-damage.service');

async function create(req, res, next) {
  try {
    const data = await service.create(req.body || {}, req.user.user_id);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function photo(req, res, next) {
  try {
    const { bookingId, incidentId, inspectionId, index } = req.params;
    const image = incidentId
      ? await service.operatorPhoto(bookingId, incidentId, index)
      : await service.evidencePhoto(inspectionId, index);
    return res
      .set('Cache-Control', 'private, no-store')
      .set('X-Content-Type-Options', 'nosniff')
      .type(image.content_type)
      .send(Buffer.from(image.data));
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, photo };
