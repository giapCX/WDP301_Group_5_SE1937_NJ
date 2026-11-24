const { Router } = require('express');
const requireManager = require('../middleware/require-manager.middleware');
const service = require('../services/garage-maintenance.service');

const router = Router();
router.use(requireManager);
router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store').json({ success: true, data: await service.listApprovals() });
});
router.patch('/:id', async (req, res) => {
  const data = await service.decide(req.params.id, req.body || {}, req.user.user_id);
  res.json({ success: true, data });
});

module.exports = router;
