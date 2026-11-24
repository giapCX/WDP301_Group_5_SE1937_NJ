import { useEffect, useRef, useState } from 'react';
import { bookingCode, dateTime } from '../../bookings/bookingConstants';
import { garageError, inspectionPhotoUrl } from '../api/garageApi';

const ITEMS = [
  ['exterior', 'Ngoại thất'],
  ['interior', 'Nội thất'],
  ['tires', 'Lốp xe'],
  ['lights', 'Đèn'],
  ['brakes', 'Phanh'],
  ['fuel', 'Nhiên liệu'],
  ['documents', 'Giấy tờ'],
  ['safety', 'Thiết bị an toàn'],
];
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const RESULTS = { passed: 'Đạt', pass: 'Đạt', failed: 'Không đạt', fail: 'Không đạt' };

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve({
      content_type: file.type,
      base64: reader.result.split(',')[1],
    }), { once: true });
    reader.addEventListener('error', () => reject(new Error('Không thể đọc ảnh đã chọn.')), { once: true });
    reader.readAsDataURL(file);
  });
}

function SavedInspection({ inspection }) {
  return (
    <>
      <p className="garage-check-summary">
        <strong>{RESULTS[inspection.result]}</strong>
        <span>{dateTime(inspection.inspected_at)}</span>
      </p>
      <dl className="garage-check-values">
        <div><dt>Số km</dt><dd>{inspection.odometer ?? 'Chưa ghi nhận'}</dd></div>
        <div><dt>Nhiên liệu</dt><dd>{inspection.fuel_percent == null ? 'Chưa ghi nhận' : inspection.fuel_percent + '%'}</dd></div>
      </dl>
      {inspection.checklist ? (
        <ul className="garage-check-items">
          {ITEMS.map(([key, label]) => (
            <li key={key}><span>{label}</span><strong>{RESULTS[inspection.checklist[key]] || 'Chưa ghi nhận'}</strong></li>
          ))}
        </ul>
      ) : <p className="garage-check-hint">Hồ sơ này chưa ghi nhận từng hạng mục kiểm tra.</p>}
      {inspection.condition_note && <p className="garage-check-note">{inspection.condition_note}</p>}
      {inspection.photo_count > 0 && (
        <ul className="garage-check-photos">
          {Array.from({ length: inspection.photo_count }, (_, index) => {
            const link = inspectionPhotoUrl(inspection.inspection_id, index + 1);
            return <li key={link}><a href={link} target="_blank" rel="noreferrer">Xem ảnh {index + 1}</a></li>;
          })}
        </ul>
      )}
    </>
  );
}

export default function GaragePreTripInspection({ task, onSave, onClose, busy }) {
  const heading = useRef(null);
  const [checklist, setChecklist] = useState({});
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editable = task.workflow_stage === 'awaiting_vehicle' && !task.inspection;
  const completed = ITEMS.every(([item]) => checklist[item]);
  const result = Object.values(checklist).includes('failed') ? 'failed' : 'passed';

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = String(form.get('condition_note')).trim();
    if (!note) {
      setError('Vui lòng ghi tình trạng xe hoặc lý do không đạt.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const evidence = await Promise.all(photos.map(readPhoto));
      await onSave(task, {
        checklist,
        result,
        odometer: Number(form.get('odometer')),
        fuel_percent: Number(form.get('fuel_percent')),
        condition_note: note,
        photos: evidence,
      });
    } catch (failure) {
      setError(failure.response ? garageError(failure) : failure.message || garageError(failure));
    } finally {
      setSaving(false);
    }
  }

  function choosePhotos(event) {
    const files = Array.from(event.target.files);
    let message = '';
    if (files.length > MAX_PHOTOS) message = 'Chỉ chọn tối đa 3 ảnh.';
    else if (files.some((file) => !IMAGE_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES)) {
      message = 'Ảnh phải là JPG hoặc PNG và tối đa 2 MB mỗi ảnh.';
    }
    event.target.setCustomValidity(message);
    setPhotos(message ? [] : files);
    setError(message);
  }

  return (
    <section className="garage-check-panel" aria-labelledby="garage-check-title">
      <header className="garage-check-header">
        <div>
          <h2 id="garage-check-title" tabIndex={-1} ref={heading}>Kiểm tra xe trước chuyến</h2>
          <p>{bookingCode(task.booking_id)} · {task.vehicle?.plate_number} · {task.vehicle?.brand} {task.vehicle?.model}</p>
        </div>
        <button type="button" className="dispatch-button subtle compact" onClick={onClose} disabled={saving}>Đóng</button>
      </header>
      {task.inspection && <SavedInspection inspection={task.inspection} />}
      {!task.inspection && !editable && <p className="garage-check-hint">Chờ tài xế chấp nhận phân công để mở checklist.</p>}
      {editable && (
        <form className="garage-check-form" onSubmit={submit}>
          <fieldset className="garage-check-fields" disabled={saving || busy}>
            <legend>Checklist an toàn</legend>
            <div className="garage-check-grid">
              {ITEMS.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <select
                    required
                    value={checklist[key] || ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setChecklist((current) => ({ ...current, [key]: value }));
                    }}
                  >
                    <option value="" disabled>Chọn kết quả</option>
                    <option value="passed">Đạt</option>
                    <option value="failed">Không đạt</option>
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="garage-check-fields" disabled={saving || busy}>
            <legend>Số km và hiện trạng</legend>
            <div className="garage-check-grid garage-check-measurements">
              <label>Số km đồng hồ (km)<input name="odometer" type="number" min="0" step="0.1" required /></label>
              <label>Nhiên liệu (%)<input name="fuel_percent" type="number" min="0" max="100" step="1" required /></label>
            </div>
            <label>Ghi chú tình trạng xe<textarea name="condition_note" rows={3} maxLength={1000} required /></label>
            <label>
              Ảnh hiện trạng
              <input type="file" multiple required accept={IMAGE_TYPES.join(',')} onChange={choosePhotos} aria-describedby="garage-photo-hint" />
            </label>
            <p id="garage-photo-hint" className="garage-check-hint">1–3 ảnh JPG hoặc PNG, tối đa 2 MB mỗi ảnh.</p>
          </fieldset>
          {error && <p className="dispatch-alert" role="alert">{error}</p>}
          <div className="garage-check-actions">
            {completed && <p aria-live="polite">Kết quả <strong>{RESULTS[result]}</strong>{result === 'failed' && '. Xe sẽ được khóa để Operator xử lý.'}</p>}
            <button type="submit" className="dispatch-button primary" disabled={!completed || !photos.length || saving || busy}>
              {saving ? 'Đang lưu…' : 'Lưu kết quả kiểm tra'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
