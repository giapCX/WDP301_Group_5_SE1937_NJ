import { useState } from 'react';
import { garageError } from '../api/garageApi';
import { CHECKLIST_ITEMS, INSPECTION_RESULTS } from '../garageConstants';
import GaragePhotoInput, { encodePhotos } from './GaragePhotoInput';

export default function GarageInspectionForm({ onSave, minOdometer = 0, returning = false }) {
  const [checklist, setChecklist] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const complete = Object.keys(checklist).length === CHECKLIST_ITEMS.length;
  const result = Object.values(checklist).includes('failed') ? 'failed' : 'passed';
  const evidenceRequired = !returning || result === 'failed';

  function invalidField(event) {
    if (event.defaultPrevented) return;
    event.preventDefault();
    const { name, validity } = event.target;
    if (name === 'odometer') {
      setError(validity.rangeUnderflow && minOdometer > 0
        ? 'Số km tiếp nhận không được thấp hơn lúc bàn giao.'
        : 'Vui lòng nhập số km đồng hồ hợp lệ.');
    } else if (name === 'fuel_percent') {
      setError('Mức nhiên liệu phải là số nguyên từ 0 đến 100%.');
    } else {
      setError('Vui lòng chọn kết quả cho đủ 8 hạng mục.');
    }
  }

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = form.get('condition_note').trim();
    const odometer = form.get('odometer');
    const fuel = form.get('fuel_percent');
    if (!odometer || !fuel) {
      setError('Vui lòng nhập số km đồng hồ và mức nhiên liệu.');
      return;
    }
    if (evidenceRequired && !note) {
      setError('Vui lòng ghi tình trạng xe hoặc lý do không đạt.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        checklist,
        result,
        odometer: Number(odometer),
        fuel_percent: Number(fuel),
        condition_note: note,
        photos: await encodePhotos(form),
      });
    } catch (failure) {
      setError(garageError(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="garage-check-form" onSubmit={submit} onInvalid={invalidField}>
      <fieldset className="garage-check-fields" disabled={saving}>
        <legend>Checklist an toàn</legend>
        <div className="garage-check-grid">
          {CHECKLIST_ITEMS.map(([key, label]) => (
            <label key={key}>
              {label}
              <select required defaultValue="" onChange={(event) => {
                const value = event.target.value;
                setChecklist((current) => ({ ...current, [key]: value }));
                setError('');
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
          <label>Số km đồng hồ (km)<input name="odometer" type="number" min={minOdometer} step="any" /></label>
          <label>Nhiên liệu (%)<input name="fuel_percent" type="number" min="0" max="100" /></label>
        </div>
        <label>
          {evidenceRequired ? 'Ghi chú tình trạng xe' : 'Ghi chú tình trạng xe (không bắt buộc)'}
          <textarea name="condition_note" rows={3} maxLength={1000} />
        </label>
        <GaragePhotoInput label="Ảnh hiện trạng" required={evidenceRequired} onError={setError} />
      </fieldset>
      {error && <p className="dispatch-alert" role="alert">{error}</p>}
      <div className="garage-check-actions">
        {complete && <p aria-live="polite">Kết quả <strong>{INSPECTION_RESULTS[result]}</strong>{result === 'failed' && '. Xe sẽ được chuyển sang bảo dưỡng.'}</p>}
        <button type="submit" className="dispatch-button primary" disabled={!complete || saving}>
          {saving ? 'Đang lưu…' : returning ? 'Ghi nhận tiếp nhận xe' : 'Lưu kết quả kiểm tra'}
        </button>
      </div>
    </form>
  );
}
