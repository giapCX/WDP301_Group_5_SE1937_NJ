import { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import GaragePhotoPreview from '../../garage/components/GaragePhotoPreview';
import InspectionChecklistResults from '../../garage/components/InspectionChecklistResults';
import { confirmOwnerReturn, requestOwnerInspectionSchedule, respondToOwnerInspection, respondToOwnerIntake } from '../api/ownerApi';

const conclusion = { pass: 'Đạt', requires_repair: 'Cần sửa và kiểm định lại', fail: 'Không đạt' };
const conditionText = { good: 'Tốt', attention: 'Cần chú ý', damaged: 'Hư hỏng' };

function ConditionSummary({ report, odometer, fuel }) {
  return <>
    <p>ODO {odometer ?? '—'} km · Nhiên liệu / pin {fuel ?? '—'}%</p>
    <ul>{[['exterior', 'Ngoại thất'], ['interior', 'Nội thất'], ['engine', 'Động cơ'], ['tires', 'Lốp xe']].map(([key, label]) =>
      <li key={key}>{label} · {conditionText[report[key]] || '—'}</li>)}</ul>
    {report.note && <p>{report.note}</p>}
    {report.defects?.map((item) => <p key={item.code}>{item.location} · {item.description}</p>)}
    <div className="gs-photo-grid">{report.photo_keys?.map((key) => <GaragePhotoPreview key={key} photo={{ key, name: key.split('/').at(-1) }} />)}</div>
  </>;
}

export default function OwnerVehicleConditionDialog({ vehicle, onClose, onSaved }) {
  const [note, setNote] = useState('');
  const [requestedFor, setRequestedFor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { inspection, intake, ownerReturn, inspectionScheduleRequest } = vehicle;
  const report = inspection?.conditionReport || {};
  const canRespond = inspection?.status === 'pending' && !inspection.ownerReview && report.checklist?.length > 0;
  const canRequestSchedule = ['submitted', 'pending_review', 'revision_required'].includes(vehicle.approvalStatus)
    && ['with_owner', 'returned_to_owner'].includes(vehicle.operatingStatus)
    && !['draft', 'pending'].includes(inspection?.status)
    && inspectionScheduleRequest?.status !== 'pending';

  async function requestSchedule(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await requestOwnerInspectionSchedule(vehicle.id, {
        requestedFor: new Date(requestedFor).toISOString(),
        note,
      });
      setNote('');
      setRequestedFor('');
      onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function respond(record, status, send) {
    if (busy) return;
    if (status === 'disputed' && !note.trim()) {
      setError('Hãy ghi rõ hạng mục và nội dung bạn chưa đồng ý.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await send(vehicle.id, record.id, { status, note, version: record.version });
      onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <Modal title={`Hiện trạng xe · ${vehicle.licensePlate}`} className="owner-modal" onClose={busy ? () => {} : onClose}>
    <p><strong>Khai báo của bạn</strong> · {vehicle.conditionDeclaration || 'Chưa có khai báo riêng.'}</p>
    {inspection?.status === 'draft' ? <section>
      <h3>Lịch kiểm định xe</h3>
      <p>{inspection.scheduledFor ? new Date(inspection.scheduledFor).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Garage đang chuẩn bị kiểm định.'}</p>
      {inspection.scheduleNote && <p>{inspection.scheduleNote}</p>}
    </section> : inspection ? <section>
      <h3>Báo cáo kiểm định · phiên bản {inspection.version ?? '—'}</h3>
      <p>Kết luận Garage · {conclusion[inspection.recommendation] || 'Chưa cập nhật'}</p>
      <ConditionSummary report={report} odometer={report.odometer_km} fuel={report.fuel_level_pct} />
      <InspectionChecklistResults items={report.checklist} />
      {inspection.decisionReason && <p>Quyết định Manager · {inspection.decisionReason}</p>}
      {inspection.ownerReview && <p>Phản hồi của bạn · {inspection.ownerReview.status === 'accepted' ? 'Đã xác nhận' : 'Có bất đồng'}
        {inspection.ownerReview.note && ` · ${inspection.ownerReview.note}`}</p>}
      {canRespond && <div className="owner-form">
        <label>Ý kiến về hiện trạng<textarea value={note} maxLength={1000} disabled={busy} onChange={(event) => setNote(event.target.value)} /></label>
        <div className="owner-modal-actions">
          <button type="button" className="owner-secondary" disabled={busy} onClick={() => respond(inspection, 'disputed', respondToOwnerInspection)}>Ghi nhận bất đồng</button>
          <button type="button" className="owner-primary" disabled={busy} onClick={() => respond(inspection, 'accepted', respondToOwnerInspection)}>Xác nhận hiện trạng</button>
        </div>
      </div>}
    </section> : <p>Garage chưa gửi báo cáo kiểm định.</p>}
    {inspectionScheduleRequest && <section>
      <h3>Đề xuất lịch kiểm định</h3>
      <p>{inspectionScheduleRequest.status === 'confirmed' ? 'Operator đã xác nhận lịch.' : 'Đang chờ Operator xác nhận lịch.'}
        {' · '}{new Date(inspectionScheduleRequest.scheduledFor || inspectionScheduleRequest.requestedFor).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
      {inspectionScheduleRequest.note && <p>Ghi chú của bạn · {inspectionScheduleRequest.note}</p>}
      {inspectionScheduleRequest.responseNote && <p>Phản hồi Operator · {inspectionScheduleRequest.responseNote}</p>}
    </section>}
    {canRequestSchedule && <form className="owner-form" onSubmit={requestSchedule}>
      <h3>Yêu cầu Operator xác nhận lịch kiểm định</h3>
      <label>Thời gian đề xuất<input type="datetime-local" required value={requestedFor} onChange={(event) => setRequestedFor(event.target.value)} disabled={busy} /></label>
      <label>Ghi chú<textarea required minLength={5} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} /></label>
      <button className="owner-primary" type="submit" disabled={busy || !requestedFor}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu lịch'}</button>
    </form>}
    {intake && <section>
      <h3>Biên bản tiếp nhận vào gara</h3>
      <p>Mã biên bản {intake.id} · {intake.confirmedAt ? new Date(intake.confirmedAt).toLocaleString('vi-VN') : 'Chưa có giờ xác nhận'}</p>
      <ConditionSummary report={intake.condition || {}} odometer={intake.odometer} fuel={intake.fuel} />
      {intake.ownerReview && <p>Phản hồi của bạn · {intake.ownerReview.status === 'accepted' ? 'Đã xác nhận' : 'Có bất đồng'}
        {intake.ownerReview.note && ` · ${intake.ownerReview.note}`}</p>}
      {intake.status === 'draft' && !intake.ownerReview && intake.odometer != null && intake.fuel != null
        && ['exterior', 'interior', 'engine', 'tires'].every((key) => intake.condition?.[key]) && <div className="owner-form">
          <label>Ý kiến về biên bản tiếp nhận<textarea value={note} maxLength={1000} disabled={busy} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="owner-modal-actions">
            <button type="button" className="owner-secondary" disabled={busy} onClick={() => respond(intake, 'disputed', respondToOwnerIntake)}>Ghi nhận bất đồng khi tiếp nhận</button>
            <button type="button" className="owner-primary" disabled={busy} onClick={() => respond(intake, 'accepted', respondToOwnerIntake)}>Xác nhận biên bản tiếp nhận</button>
          </div>
        </div>}
    </section>}
    {ownerReturn && <section>
      <h3>Biên bản trả xe cho chủ</h3>
      <p>Đối chiếu biên bản tiếp nhận {ownerReturn.intake_id} · phiên bản {ownerReturn.version}</p>
      <p>Giờ giao xe · {new Date(ownerReturn.returned_at).toLocaleString('vi-VN')}</p>
      <ConditionSummary report={ownerReturn.condition || {}} odometer={ownerReturn.odometer_km} fuel={ownerReturn.fuel_level_pct} />
      {ownerReturn.damage_changes?.length > 0 && <ul aria-label="Chênh lệch so với lúc tiếp nhận">
        {ownerReturn.damage_changes.map(({ code, change }) => {
          const defect = ownerReturn.condition?.defects?.find((item) => item.code === code)
            || intake?.condition?.defects?.find((item) => item.code === code);
          const label = { unchanged: 'Giữ nguyên', new: 'Lỗi mới', worsened: 'Nặng thêm', unverified: 'Chưa xác minh' }[change];
          return <li key={code}>{defect?.location || code} · {label}</li>;
        })}
      </ul>}
      {ownerReturn.owner_response && <p>{ownerReturn.owner_response === 'accepted' ? 'Đã nhận xe và đồng ý hiện trạng.' : `Đã nhận xe, có bất đồng: ${ownerReturn.owner_note}`}</p>}
      {ownerReturn.status === 'processing' && <div className="owner-form">
        <label>Ý kiến khi nhận lại xe<textarea value={note} maxLength={1000} disabled={busy} onChange={(event) => setNote(event.target.value)} /></label>
        <div className="owner-modal-actions">
          <button type="button" className="owner-secondary" disabled={busy} onClick={() => respond(ownerReturn, 'disputed', (_, id, data) => confirmOwnerReturn(id, { ...data, received: true }))}>Đã nhận xe, có bất đồng</button>
          <button type="button" className="owner-primary" disabled={busy} onClick={() => respond(ownerReturn, 'accepted', (_, id, data) => confirmOwnerReturn(id, { ...data, received: true }))}>Đã nhận xe và đồng ý</button>
        </div>
      </div>}
    </section>}
    {error && <p role="alert">{error}</p>}
  </Modal>;
}
