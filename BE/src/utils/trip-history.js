module.exports = function addTripHistory(workflow, action, actorId, note = null) {
  const createdAt = new Date();
  workflow.history.push({ action, actor_id: actorId, note, created_at: createdAt });
  workflow.updated_at = createdAt;
};
