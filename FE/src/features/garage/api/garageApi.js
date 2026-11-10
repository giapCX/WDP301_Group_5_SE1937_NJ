import { getApi, getBlobApi, patchApi, postApi } from '../../../services/httpClient';

export const getGarageWorkspace = (options) => getApi('/garage/workspace', options);
export const uploadGaragePhoto = (body) => postApi('/garage/photos', body).then(({ data }) => data);
export const getGaragePhoto = (key, options) => getBlobApi(`/garage/photos/${key.replace(/^garage-photos\//, '').split('/').map(encodeURIComponent).join('/')}`, options);

export async function saveGarageTask(task, report, draft, checkpoint) {
  const condition = {
    ...Object.fromEntries(['exterior', 'interior', 'engine', 'tires'].filter((key) => report[key]).map((key) => [key, report[key]])),
    note: report.note || '', photoKeys: (report.photos || []).map((photo) => photo.key),
  };
  const body = { condition };
  if (task.kind === 'intake') condition.accessories = report.accessories || [];
  if (report.odometer !== '') body.odometerKm = Number(report.odometer);
  if (report.fuel !== '') body.fuelLevelPct = Number(report.fuel);
  if (task.kind === 'inspection' && report.recommendation) body.recommendation = { pass: 'pass', revision: 'requires_repair', reject: 'fail' }[report.recommendation];
  const base = task.kind === 'inspection' ? '/garage/inspections' : task.kind === 'intake' ? '/garage/intakes' : '/garage/handovers';
  let record;
  if (task.recordId) {
    ({ data: record } = await patchApi(`${base}/${task.recordId}`, { ...body, version: task.version }));
  } else {
    const identity = task.kind === 'inspection' ? { vehicleId: task.vehicleId } : task.kind === 'intake'
      ? { vehicleId: task.vehicleId, managementAgreementId: task.agreementId }
      : { bookingId: task.bookingId, type: task.kind === 'handover' ? 'pickup' : 'return' };
    ({ data: record } = await postApi(base, { ...body, ...identity }));
  }
  checkpoint({ recordId: record._id, version: record.version });
  if (draft) return record;
  const action = task.kind === 'inspection' ? 'submit' : 'confirm';
  const confirmation = { version: record.version, ...(task.kind === 'intake' ? { ownerConfirmed: report.confirmed } : task.kind === 'inspection' ? {} : { renterConfirmed: report.confirmed }) };
  const { data } = await postApi(`${base}/${record._id}/${action}`, confirmation);
  checkpoint({ recordId: data._id, version: data.version });
  return data;
}

export const reportGarageIncident = (incident, requestId) => postApi('/garage/incidents', {
  vehicleId: incident.vehicleId, ...(incident.bookingId ? { bookingId: incident.bookingId } : {}),
  description: incident.description, severity: incident.severity, photoKeys: incident.photos.map((photo) => photo.key), requestId,
});
