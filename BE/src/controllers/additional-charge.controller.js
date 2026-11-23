const service = require('../services/additional-charge.service');

function list(renter = false) {
  return async (req, res, next) => {
    try {
      const result = await service.list(
        req.query,
        req.params.id,
        renter ? req.user.user_id : undefined,
      );
      return res.json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  };
}

function detail(renter = false) {
  return async (req, res, next) => {
    try {
      const result = await service.detail(
        req.params.id,
        req.params.chargeId,
        renter ? req.user.user_id : undefined,
      );
      return res.json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  };
}

function mutate(action) {
  return async (req, res, next) => {
    try {
      const result = await service.mutate(
        action,
        req.params.id,
        req.params.chargeId,
        req.body,
        req.user.user_id,
      );
      return res
        .status(action === 'create' ? 201 : 200)
        .json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { list, detail, mutate };
