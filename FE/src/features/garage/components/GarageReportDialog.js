import { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Icon from '../../../components/ui/Icon';
import GaragePhotoUpload from './GaragePhotoUpload';
import GarageStatus from './GarageStatus';
import GarageInspectionChecklist from './GarageInspectionChecklist';
import GarageConditionDefects from './GarageConditionDefects';
import GarageManagerDecision from './GarageManagerDecision';
import {
  conditionFields,
  conditionLabels,
  displayDate,
  displayTime,
  taskBlockers,
  taskKinds,
  validateGarageReport,
} from '../data/garage';

function toLocalInput(value) {
  const date = new Date(value);
  return new Date(+date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function GarageReportDialog({ task, onSave, onClose }) {
  const [report, setReport] = useState(() => ({
    odometer: String(task.odometer),
    fuel: String(task.fuel),
    exterior: '',
    interior: '',
    engine: '',
    tires: '',
    recommendation: '',
    note: '',
    photos: [],
    accessories: [],
    ...task.report,
    confirmed: Boolean(task.report?.confirmed || (task.kind === 'intake' && task.ownerReview?.status === 'accepted')),
    defects: task.report?.defects ?? (!task.recordId ? task.baselineCondition?.defects?.map((defect) => ({ ...defect, photo_key: '' })) : undefined),
    disputeNote: task.renterDisputeNote || '',
    occurredAt: task.kind === 'owner-return' && task.occurredAt ? toLocalInput(task.occurredAt) : '',

  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingAcceptedIntake, setEditingAcceptedIntake] = useState(false);
  const readOnly = task.readOnly || ['completed', 'submitted', 'approved', 'rejected', 'revision_required'].includes(task.status);
  const ownerIntakeAccepted = task.kind === 'intake' && task.ownerReview?.status === 'accepted' && !editingAcceptedIntake;
  const needsOwnerIntake = task.kind === 'intake' && Boolean(task.conditionDeclaration);
  const blockers = taskBlockers(task);
  const set = (key, value) =>
    setReport((previous) => ({ ...previous, [key]: value }));
  const submitLabel =
    task.kind === 'inspection'
      ? 'Gửi đề xuất kiểm định'
      : task.kind === 'intake'
        ? 'Xác nhận tiếp nhận xe'
        : task.kind === 'handover'
          ? 'Xác nhận bàn giao xe'
          : task.kind === 'owner-return' ? 'Gửi chủ xe xác nhận' : 'Xác nhận nhận trả xe';
  const confirmLabel =
    task.kind === 'intake'
      ? 'Đã ghi nhận xác nhận bàn giao của chủ xe'
      : task.kind === 'handover'
        ? 'Khách thuê đã xác nhận nhận xe và tình trạng bàn giao'
        : 'Đã ghi nhận xác nhận trả xe của khách thuê';
  async function save(draft) {
    if (busy || uploading) return;
    setError('');
    setBusy(true);
    try { await onSave(task.id, report, draft); }
    catch (failure) {
      const blockers = failure.data?.error?.details?.blockers?.map((item) => item.message).join(' ');
      setError([failure.message, blockers, failure.status === 409 ? 'Hãy đóng biên bản, tải lại danh sách và mở lại để kiểm tra dữ liệu mới nhất.' : ''].filter(Boolean).join(' '));
    } finally { setBusy(false); }
  }
  function submit(event) {
    event.preventDefault();
    if (needsOwnerIntake && !ownerIntakeAccepted) {
      setError('Lưu biên bản và chờ chủ xe xác nhận ở mục Xem hiện trạng trước khi hoàn tất.');
      return;
    }
    const message = validateGarageReport(task, report);
    if (message) {
      setError(message);
      return;
    }
    save(false);
  }
  if (readOnly && !task.recordId && task.vehicleReviewStatus === 'rejected') return <Modal title={`Hồ sơ xe · ${task.plate}`} className="gs-dialog" onClose={onClose}>
    <h3>{task.vehicle}</h3>
    <GarageManagerDecision task={task} />
    <p>Hồ sơ đã bị từ chối trước khi có biên bản kiểm định.</p>
  </Modal>;
  return (
    <Modal
      title={`${taskKinds[task.kind]} · ${task.id}`}
      className="gs-dialog"
      onClose={busy || uploading ? () => {} : onClose}
    >
      <GarageManagerDecision task={task} />
      {needsOwnerIntake && <p className="gs-form-hint">{ownerIntakeAccepted ? 'Chủ xe đã xác nhận phiên bản này.'
        : task.ownerReview?.status === 'disputed' ? `Chủ xe có bất đồng: ${task.ownerReview.note}`
          : 'Lưu biên bản để chủ xe xem và xác nhận trong Đội xe của tôi.'}</p>}
      <div className="gs-report-vehicle">
        <span className={`gs-car-tile gs-car-tile--${task.kind}`}>
          <Icon name="car" size={30} />
        </span>
        <div>
          <h3>{task.vehicle}</h3>
          <p>
            {task.plate} · {task.reference}
          </p>
        </div>
        <GarageStatus
          status={task.status}
          blocked={blockers.length > 0 && !readOnly}
        />
      </div>
      <div className="gs-report-facts">
        <div>
          <small>
            {['intake', 'inspection', 'owner-return'].includes(task.kind)
              ? 'CHỦ XE'
              : 'KHÁCH THUÊ'}
          </small>
          <strong>{task.contact}</strong>
        </div>
        <div>
          <small>LỊCH HẸN</small>
          <strong>
            {task.scheduled === false ? 'Chưa có lịch hẹn' : `${displayTime(task.schedule)} · ${displayDate(task.schedule)}`}
          </strong>
        </div>
        <div>
          <small>ĐỊA ĐIỂM</small>
          <strong>{task.location}</strong>
        </div>
        <div>
          <small>VỊ TRÍ XE</small>
          <strong>{task.bay}</strong>
        </div>
      </div>
      {task.scheduleNote && <p className="gs-form-hint">Ghi chú lịch kiểm định: {task.scheduleNote}</p>}
      {blockers.length > 0 && !readOnly && (
        <div className="gs-blocker">
          <Icon name="alert" size={20} />
          <div>
            <strong>Chưa đủ điều kiện hoàn tất</strong>
            {blockers.map((message) => (
              <p key={message}>{message}</p>
            ))}
            <small>Bạn có thể chuẩn bị và lưu nháp biên bản.</small>
          </div>
        </div>
      )}
      {task.kind === 'return' && (
        <div className="gs-return-baseline">
          <Icon name="history" size={17} />
          <span>
            Khi giao xe:{' '}
            <strong>{task.odometer.toLocaleString('vi-VN')} km</strong> · Nhiên
            liệu / pin <strong>{task.fuel}%</strong>
          </span>
        </div>
      )}
      {readOnly && !task.report ? (
        <div className="gs-empty">
          <Icon name="check" size={30} />
          <h3>Biên bản chưa có báo cáo chi tiết</h3>
          <p>Biên bản này được mở ở chế độ chỉ xem.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="gs-report-form">
          <fieldset disabled={readOnly || ownerIntakeAccepted || busy || uploading}>
            <legend className="gs-form-section-title">
              01{' '}
              <span>
                Chỉ số tại thời điểm{' '}
                {task.kind === 'return' ? 'nhận trả' : 'kiểm tra'}
              </span>
            </legend>
            <div className="gs-form-grid">
              <label>
                Số km trên đồng hồ
                <input
                  aria-label="Số km trên đồng hồ"
                  type="number"
                  min={task.odometer}
                  step="1"
                  value={report.odometer}
                  onChange={(e) => set('odometer', e.target.value)}
                />
                <small>
                  Đã ghi nhận: {task.odometer.toLocaleString('vi-VN')} km
                </small>
              </label>
              <label>
                Nhiên liệu / pin (%)
                <input
                  aria-label="Nhiên liệu / pin (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={report.fuel}
                  onChange={(e) => set('fuel', e.target.value)}
                />
                <small>Mức hiện tại từ 0 đến 100%</small>
              </label>
            </div>
          </fieldset>
          <fieldset disabled={readOnly || ownerIntakeAccepted || busy || uploading}>
            <legend className="gs-form-section-title">
              02 <span>Tình trạng xe</span>
            </legend>
            {ownerIntakeAccepted && !readOnly && <button type="button" className="gs-button gs-button-secondary" onClick={() => setEditingAcceptedIntake(true)}>
            Sửa biên bản và xin xác nhận lại
          </button>}
          {!readOnly && (
              <button
                type="button"
                className="gs-text-link gs-normal-button"
                onClick={() =>
                  setReport((previous) => ({
                    ...previous,
                    ...Object.fromEntries(
                      conditionFields.map(([key]) => [key, 'good']),
                    ),
                  }))
                }
              >
                <Icon name="check" size={14} />
                Tất cả bình thường
              </button>
            )}
            <div className="gs-form-grid">
              {conditionFields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <select
                    value={report[key]}
                    onChange={(e) => set(key, e.target.value)}
                  >
                    <option value="">Chọn đánh giá</option>
                    {Object.entries(conditionLabels).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="gs-note-label">
              Ghi chú tình trạng
              <textarea
                rows="3"
                maxLength="1500"
                placeholder="Mô tả vị trí, tình trạng hoặc điểm cần lưu ý..."
                value={report.note}
                onChange={(e) => set('note', e.target.value)}
              />
            </label>
          </fieldset>
          <GaragePhotoUpload
            photos={report.photos}
            maxPhotos={30}
            onChange={(photos) => set('photos', photos)}
            readOnly={readOnly || ownerIntakeAccepted || busy}
            onBusyChange={setUploading}
          />
          {task.kind === 'inspection' ? <GarageInspectionChecklist
            declaration={task.conditionDeclaration}
            items={report.checklist || []}
            photos={report.photos}
            onChange={(items) => set('checklist', items)}
            disabled={readOnly || ownerIntakeAccepted || busy || uploading}
          /> : <GarageConditionDefects
            items={report.defects || []}
            baseline={['return', 'owner-return'].includes(task.kind) ? task.baselineCondition?.defects || [] : []}
            changes={task.damageChanges}
            photos={report.photos}
            onChange={(items) => set('defects', items)}
            disabled={readOnly || ownerIntakeAccepted || busy || uploading}
          />}
          {task.kind !== 'inspection' && <fieldset disabled={readOnly || ownerIntakeAccepted || busy || uploading}>
            <legend className="gs-form-section-title">Chìa khóa, giấy tờ và phụ kiện</legend>
            {[['vehicle_key', 'Chìa khóa xe'], ['registration_copy', 'Bản sao đăng ký xe'], ['emergency_kit', 'Bộ dụng cụ khẩn cấp']].map(([key, label]) => <label className="gs-confirm-row" key={key}>
              <input type="checkbox" checked={report.accessories.includes(key)} onChange={(event) => set('accessories', event.target.checked ? [...report.accessories, key] : report.accessories.filter((value) => value !== key))} />
              {label}
            </label>)}
          </fieldset>}
          <fieldset disabled={readOnly || ownerIntakeAccepted || busy || uploading}>
            <legend className="gs-form-section-title">
              03{' '}
              <span>
                {task.kind === 'inspection'
                  ? 'Đề xuất kiểm định'
                  : 'Xác nhận giao nhận'}
              </span>
            </legend>
            {task.kind === 'inspection' ? (
              <>
                <div className="gs-recommendations">
                  {[
                    ['pass', 'Đề xuất đạt'],
                    ['revision', 'Yêu cầu bổ sung'],
                    ['reject', 'Không đạt'],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className={
                        report.recommendation === value
                          ? 'gs-choice-active'
                          : ''
                      }
                    >
                      <input
                        type="radio"
                        name="recommendation"
                        value={value}
                        checked={report.recommendation === value}
                        onChange={() => set('recommendation', value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="gs-form-hint">
                  <Icon name="shield" size={15} />
                  Chủ xe xem hiện trạng trước khi Manager duyệt hồ sơ có checklist.
                </p>
              </>
            ) : task.kind === 'owner-return' ? <p>Chủ xe xác nhận đã nhận xe trong Đội xe của tôi.</p> : (
              <label className="gs-confirm-row">
                <input
                  type="checkbox"
                  checked={report.confirmed}
                  onChange={(e) => set('confirmed', e.target.checked)}
                />
                {confirmLabel}
              </label>
            )}
            {['return', 'owner-return'].includes(task.kind) && <div className="gs-form-grid">
              <label>{task.kind === 'owner-return' ? 'Giờ giao xe thực tế' : 'Giờ xe về thực tế'}
                {readOnly ? <span>{task.occurredAt ? new Date(task.occurredAt).toLocaleString('vi-VN') : '—'}</span>
                  : <input type="datetime-local" max={toLocalInput(new Date())} value={report.occurredAt} onChange={(event) => set('occurredAt', event.target.value)} />}
              </label>
              {task.kind === 'return' && !report.confirmed && <label>Lý do khách chưa xác nhận / ý kiến bất đồng
                <textarea value={report.disputeNote} maxLength={1000} onChange={(event) => set('disputeNote', event.target.value)} />
              </label>}
            </div>}
            {task.kind === 'return' && (
              <p className="gs-form-hint">
                Nếu có bất thường, hệ thống sẽ tạo báo cáo để bộ phận vận hành
                tiếp nhận. Không tự quyết định bồi thường hoặc hoàn cọc.
              </p>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="gs-form-error">
              {error}
            </p>
          )}
          {!readOnly && (
            <div className="gs-dialog-actions">
              {task.kind !== 'owner-return' && <button
                type="button"
                className="gs-button gs-button-secondary"
                onClick={() => save(true)}
                disabled={ownerIntakeAccepted || busy || uploading}
              >
                Lưu bản nháp
              </button>}
              <button
                type="submit"
                className="gs-button gs-button-primary"
                disabled={blockers.length > 0 || busy || uploading}
              >
                <Icon name="check" size={16} />
                {busy ? 'Đang lưu...' : submitLabel}
              </button>
            </div>
          )}
        </form>
      )}
      {readOnly && (
        <div className="gs-dialog-actions">
          <span className="gs-muted">
            Biên bản đã gửi được mở ở chế độ chỉ xem.
          </span>
          <button className="gs-button gs-button-secondary" onClick={onClose}>
            Đóng biên bản
          </button>
        </div>
      )}
    </Modal>
  );
}
