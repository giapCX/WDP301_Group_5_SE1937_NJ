const { randomUUID } = require('node:crypto');
const { Incident, TripWorkflow, Vehicle } = require('../models');
const repository = require('../repositories/operations.repository');
const { positiveId } = require('../utils/numeric-id');
const { text, amount, evidence, event, notify } = require('./operation-validation');
const { reserveRefunds } = require('./cancellation.service');
const HttpError = require('../utils/http-error');
async function report(id, input, actor) {
  const description = text(input.description, 'Mô tả');
  if (!['other', 'complaint', 'accident', 'vehicle_failure', 'customer_route_change'].includes(input.kind)) throw new HttpError(400, 'Loại sự cố không hợp lệ');
  const proof = evidence(input.evidence);
  return repository.transaction(async (session) => {
    const booking = await repository.booking(id, actor, session);
    if (!['confirmed', 'in_progress', 'completed'].includes(booking.booking_status)) throw new HttpError(409, 'Đơn chưa xác nhận hoặc đã hủy');
    const incident_id = await repository.nextIds(Incident, 'incident_id', 1, session);
    const [incident] = await Incident.create([{ incident_id, booking_id: booking.booking_id, reported_by: actor.user_id,
      description, kind: input.kind, evidence: proof, reported_at: new Date(), incident_status: 'open',
      history: [event('reported', actor, description)] }], { session });
    notify(booking, 'incident_reported', actor, description); await booking.save({ session });
    return incident;
  });
}
async function propose(id, input, actor) {
  const note = text(input.note, 'Phương án xử lý');
  if (!['support', 'compensation', 'replace_vehicle', 'replace_driver', 'change_itinerary'].includes(input.action)) throw new HttpError(400, 'Phương án không hợp lệ');
  const value = amount(input.amount ?? 0);
  if (input.action !== 'compensation' && value) throw new HttpError(400, 'Chỉ phương án bồi thường có số tiền');
  return repository.transaction(async (session) => {
    const incident = await Incident.findOne({ incident_id: positiveId(id) }).session(session);
    if (!incident || incident.incident_status !== 'open') throw new HttpError(409, 'Sự cố đã được xử lý');
    if (['pending', 'approved'].includes(incident.resolution_approval?.status)) throw new HttpError(409, 'Đã có phương án đang chờ hoặc đã được duyệt');
    const booking = await repository.booking(incident.booking_id, actor, session);
    incident.resolution_approval = { id: randomUUID(), status: 'pending', action: input.action, note, amount: value, requested_by: actor.user_id, requested_at: new Date() };
    incident.history.push(event('approval_requested', actor, note));
    notify(booking, 'incident_approval_requested', actor, note);
    await booking.save({ session }); await incident.save({ session }); return incident;
  });
}
async function approve(id, input, actor) {
  const reason = text(input.reason);
  if (!['approve', 'reject'].includes(input.decision)) throw new HttpError(400, 'Quyết định không hợp lệ');
  return repository.transaction(async (session) => {
    const incident = await Incident.findOne({ incident_id: positiveId(id) }).session(session);
    const proposal = incident?.resolution_approval;
    if (!incident || incident.incident_status !== 'open' || proposal?.status !== 'pending' || proposal.id !== input.proposalId) throw new HttpError(409, 'Đề xuất đã thay đổi');
    const booking = await repository.booking(incident.booking_id, actor, session);
    if (input.decision === 'approve' && proposal.action === 'compensation') {
      await reserveRefunds(booking, proposal.amount, proposal.note, 'incident:' + proposal.id, actor, session);
    }
    if (input.decision === 'approve' && ['replace_vehicle', 'replace_driver', 'change_itinerary'].includes(proposal.action)) {
      const workflow = await TripWorkflow.findOne({ booking_id: booking.booking_id }).session(session);
      if (!workflow || ['completed', 'cancelled'].includes(workflow.stage)) throw new HttpError(409, 'Chưa có chuyến đang hoạt động để điều phối; chọn phương án hỗ trợ khách.');
      workflow.resume_stage ||= workflow.stage;
      if (proposal.action === 'replace_vehicle') {
        await require('../repositories/booking.repository').lockVehicleSchedule(workflow.vehicle_id, session);
        await Vehicle.updateOne({ vehicle_id: workflow.vehicle_id }, { $set: { status: 'maintenance' } }, { session });
        await require('./garage-maintenance.service').openForDamage({ vehicleId: workflow.vehicle_id, staffId: actor.user_id, description: proposal.note }, session);
        workflow.stage = 'vehicle_replacement_required';
      } else if (proposal.action === 'change_itinerary') workflow.stage = 'routed_to_booking_changes';
      else workflow.stage = 'incident_open';
      workflow.history.push({ action: 'incident_plan_approved', actor_id: actor.user_id, created_at: new Date(), note: proposal.note });
      workflow.updated_at = new Date(); await workflow.save({ session });
    }
    Object.assign(proposal, { status: input.decision === 'approve' ? 'approved' : 'rejected', reviewed_by: actor.user_id, reviewed_at: new Date(), decision_note: reason });
    incident.history.push(event('manager_' + input.decision, actor, reason));
    notify(booking, 'incident_manager_' + input.decision, actor, reason);
    await booking.save({ session }); await incident.save({ session }); return incident;
  });
}
async function resolve(id, input, actor) {
  const incident = await Incident.findOne({ incident_id: positiveId(id) }).lean();
  if (!incident) throw new HttpError(404, 'Không tìm thấy sự cố');
  // Reuse dispatch state restoration and its checks for replacement/itinerary work.
  return require('./trip-workflow.service').resolveIncident(incident.booking_id, incident.incident_id, actor.user_id, text(input.reason));
}
async function replaceDriver(id, input, actor) {
  return require('./trip-workflow.service').replaceIncidentDriver(positiveId(id), positiveId(input.driver_id, 'Tài xế'), actor.user_id, text(input.reason));
}
module.exports = { report, propose, approve, resolve, replaceDriver };
