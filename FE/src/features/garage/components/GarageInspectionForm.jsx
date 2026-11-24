import { useState } from 'react';
import { garageError } from '../api/garageApi';
import { CHECKLIST_ITEMS, INSPECTION_RESULTS } from '../garageConstants';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ content_type: file.type, base64: reader.result.split(',')[1] });
    reader.onerror = () => reject(new Error('Không thể đọc ảnh đã chọn.'));
    reader.readAsDataURL(file);
  });
}

export default function GarageInspectionForm({ onSave }) {
  const [checklist, setChecklist] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const complete = Object.keys(checklist).length === CHECKLIST_ITEMS.length;
  const result = Object.values(checklist).includes('failed') ? 'failed' : 'passed';

  function checkPhotos(event) {
    const files = Array.from(event.target.files);
    let message = '';
    if (files.length > 3) message = 'Chỉ chọn tối đa 3 ảnh.';
    else if (files.some((file) => !IMAGE_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES)) {
      message = 'Ảnh phải là JPG hoặc PNG và tối đa 2 MB mỗi ảnh.';
    }
    event.target.setCustomValidity(message);
    setError(message);
  }

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = form.get('condition_note').trim();
    if (!note) {
      setError('Vui lòng ghi tình trạng xe hoặc lý do không đạt.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        checklist,
        result,
        odometer: Number(form.get('odometer')),
        fuel_percent: Number(form.get('fuel_percent')),
        condition_note: note,
        photos: await Promise.all(form.getAll('photos').map(readPhoto)),
      });
    } catch (failure) {
      setError(garageError(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="garage-check-form" onSubmit={submit}>
      <fieldset className="garage-check-fields" disabled={saving}>
        <legend>Checklist an toàn</legend>
        <div className="garage-check-grid">
          {CHECKLIST_ITEMS.map(([key, label]) => (
            <label key={key}>
              {label}
              <select required defaultValue="" onChange={(event) => {
                const value = event.target.value;
                setChecklist((current) => ({ ...current, [key]: value }));
              }}>
                <option value="" disabled>Chọn kết quả</option>
                <option value="passed">Đạt</option>
                <option value="failed">Không đạt</option>
              </select>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="garage-check-fields" disabled={saving}>
        <legend>Số km và hiện trạng</legend>
        <div className="garage-check-grid garage-check-measurements">
          <label>Số km đồng hồ (km)<input name="odometer" type="number" min="0" step="0.1" required /></label>
          <label>Nhiên liệu (%)<input name="fuel_percent" type="number" min="0" max="100" required /></label>
        </div>
        <label>Ghi chú tình trạng xe<textarea name="condition_note" rows={3} maxLength={1000} required /></label>
        <label>
          Ảnh hiện trạng
          <input name="photos" type="file" multiple required accept={IMAGE_TYPES.join(',')}
            onChange={checkPhotos} aria-describedby="garage-photo-hint"
          />
        </label>
        <p id="garage-photo-hint" className="garage-check-hint">1–3 ảnh JPG hoặc PNG, tối đa 2 MB mỗi ảnh.</p>
      </fieldset>
      {error && <p className="dispatch-alert" role="alert">{error}</p>}
      <div className="garage-check-actions">
        {complete && <p aria-live="polite">Kết quả <strong>{INSPECTION_RESULTS[result]}</strong>{result === 'failed' && '. Xe sẽ được khóa để Operator xử lý.'}</p>}
        <button type="submit" className="dispatch-button primary" disabled={!complete || saving}>
          {saving ? 'Đang lưu…' : 'Lưu kết quả kiểm tra'}
        </button>
      </div>
    </form>
  );
}
