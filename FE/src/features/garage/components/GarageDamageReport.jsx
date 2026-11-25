import { useState } from 'react';
import { dateTime } from '../../shared/booking/bookingConstants';
import { createDamageReport, damagePhotoUrl, garageError } from '../api/garageApi';
import { CHECKLIST_ITEMS, CHECKLIST_LABELS } from '../garageConstants';
import { InspectionPhotos } from './GarageInspectionRecord';
import GaragePhotoInput, { encodePhotos } from './GaragePhotoInput';

function DamageForm({ inspection, onUpdate }) {
  const hasPhotos = inspection.photo_count > 0;
  const [source, setSource] = useState(hasPhotos ? 'inspection' : 'upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const items = form.getAll('damaged_items');
    if (!items.length) {
      setError('Chọn ít nhất một hạng mục hư hỏng.');
      return;
    }
    const description = form.get('description').trim();
    if (!description) {
      setError('Vui lòng nhập mô tả hư hỏng.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await createDamageReport({
        inspection_id: inspection.inspection_id, damaged_items: items, description,
        evidence_source: source, share_with_operator: form.has('share_with_operator'),
        ...(source === 'upload' && { photos: await encodePhotos(form) }),
      });
      onUpdate();
    } catch (failure) {
      setError(garageError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="garage-check-form" onSubmit={submit}>
      <fieldset className="garage-check-fields" disabled={busy}>
        <legend>Hạng mục hư hỏng</legend>
        <div className="garage-check-grid garage-damage-options">
          {CHECKLIST_ITEMS.map(([key, label]) => (
            <label key={key}>
              <input type="checkbox" name="damaged_items" value={key}
                defaultChecked={['fail', 'failed'].includes(inspection.checklist?.[key])}
              />
              {label}
            </label>
          ))}
        </div>
        <label>
          Mô tả hư hỏng
          <textarea name="description" rows={3} maxLength={1000} aria-required="true" defaultValue={inspection.condition_note || ''} />
        </label>
        {hasPhotos && (
          <label>
            Nguồn ảnh bằng chứng
            <select value={source} onChange={(event) => { setSource(event.target.value); setError(''); }}>
              <option value="inspection">Ảnh lúc tiếp nhận ({inspection.photo_count})</option>
              <option value="upload">Tải ảnh mới</option>
            </select>
          </label>
        )}
        {source === 'upload' && <GaragePhotoInput label="Ảnh bằng chứng" onError={setError} />}
        <div className="garage-damage-options">
          <label><input type="checkbox" name="share_with_operator" />Chuyển Operator xử lý</label>
        </div>
      </fieldset>
      {error && <p className="dispatch-alert" role="alert">{error}</p>}
      <button className="dispatch-button primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu báo cáo'}</button>
    </form>
  );
}

export default function GarageDamageReport({ inspection, report, onUpdate }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="garage-damage-report" aria-labelledby="garage-damage-title">
      <h2 id="garage-damage-title">Báo cáo hư hỏng</h2>
      {report ? (
        <>
          <p>{dateTime(report.reported_at)} · {report.damaged_items.map((key) => CHECKLIST_LABELS[key]).join(', ')}</p>
          <p className="garage-check-note">{report.description}</p>
          <InspectionPhotos inspection={report} photoUrl={damagePhotoUrl} />
          {report.maintenance_id && <p>Phiếu bảo dưỡng #{report.maintenance_id}</p>}
          {report.incident_id && <p>Sự cố #{report.incident_id} · {report.incident?.incident_status === 'resolved' ? 'Đã xử lý' : 'Chờ Operator xử lý'}</p>}
          {report.incident?.resolution_note && <p className="garage-check-note">{report.incident.resolution_note}</p>}
          {report.incident?.incident_status === 'open' && <button className="dispatch-button subtle" onClick={onUpdate}>Làm mới báo cáo</button>}
        </>
      ) : open ? (
        <DamageForm inspection={inspection} onUpdate={onUpdate} />
      ) : (
        <button className="dispatch-button primary" onClick={() => setOpen(true)}>Lập báo cáo hư hỏng</button>
      )}
    </section>
  );
}
