import { inspectionItems, inspectionResults } from '../data/inspectionChecklist';

export default function GarageInspectionChecklist({ declaration, items, photos, onChange, disabled }) {
  function update(key, changes) {
    const current = items.find((item) => item.key === key) || { key, result: 'unverified', note: '', photo_key: '' };
    onChange([...items.filter((item) => item.key !== key), { ...current, ...changes }]);
  }
  return <fieldset disabled={disabled}>
    <legend className="gs-form-section-title">Checklist kiểm định đầu vào</legend>
    <p>Khai báo của chủ xe: {declaration || 'Chưa có khai báo riêng.'}</p>
    {inspectionItems.map(([key, label]) => {
      const item = items.find((entry) => entry.key === key);
      return <div key={key} className="gs-form-grid">
        <label>{label}
          <select value={item?.result || ''} onChange={(event) => update(key, { result: event.target.value })}>
            <option value="" disabled>Chọn kết quả</option>
            {Object.entries(inspectionResults).filter(([result]) =>
              (result !== 'not_applicable' || key === 'accessories')
              && (result !== 'recorded' || ['exterior', 'interior', 'accessories'].includes(key))
            ).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </label>
        <label>Phương pháp, số đo hoặc chênh lệch · {label}
          <input value={item?.note || ''} maxLength={500} onChange={(event) => update(key, { note: event.target.value })} />
        </label>
        <label>Ảnh tham chiếu · {label}
          <select value={item?.photo_key || ''} onChange={(event) => update(key, { photo_key: event.target.value })}>
            <option value="">Chọn ảnh đã tải lên</option>
            {photos.map(({ key: photoKey, name }) => <option key={photoKey} value={photoKey}>{name}</option>)}
          </select>
        </label>
      </div>;
    })}
  </fieldset>;
}
