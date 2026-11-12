const changeLabels = { unchanged: 'Giữ nguyên', new: 'Lỗi mới', worsened: 'Nặng thêm', unverified: 'Chưa xác minh' };

function defectCode() {
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export default function GarageConditionDefects({ items, baseline, changes, photos, onChange, disabled }) {
  const add = () => onChange([...items, {
    code: defectCode(), location: '', description: '', severity: 'attention', photo_key: '',
  }]);
  function update(code, changes) {
    onChange(items.map((item) => item.code === code ? { ...item, ...changes } : item));
  }
  return <fieldset disabled={disabled}>
    <legend className="gs-form-section-title">Lỗi hiện trạng theo vị trí</legend>
    {baseline.length > 0 && <ul aria-label="Lỗi đã ghi khi giao xe">
      {baseline.map((item) => <li key={item.code}>
        Lúc giao: {item.location} · {item.description} · {item.severity === 'damaged' ? 'Hư hỏng' : 'Cần chú ý'}
        {changes?.find((change) => change.code === item.code)?.change === 'unverified' && ' · Chưa xác minh khi trả'}
      </li>)}
    </ul>}
    {items.map((item, index) => <div key={item.code} className="gs-form-grid">
      <label>Vị trí lỗi {index + 1}<input maxLength={120} value={item.location} onChange={(event) => update(item.code, { location: event.target.value })} /></label>
      <label>Mô tả lỗi {index + 1}<input maxLength={500} value={item.description} onChange={(event) => update(item.code, { description: event.target.value })} /></label>
      <label>Mức độ lỗi {index + 1}<select value={item.severity} onChange={(event) => update(item.code, { severity: event.target.value })}>
        <option value="attention">Cần chú ý</option><option value="damaged">Hư hỏng</option>
      </select></label>
      <label>Ảnh lỗi {index + 1}<select value={item.photo_key} onChange={(event) => update(item.code, { photo_key: event.target.value })}>
        <option value="">Chọn ảnh đã tải lên</option>
        {photos.map(({ key, name }) => <option key={key} value={key}>{name}</option>)}
      </select></label>
      {changes && <span>{changeLabels[changes.find((change) => change.code === item.code)?.change]}</span>}
      {!disabled && <button type="button" className="gs-btn gs-btn-secondary" onClick={() => onChange(items.filter(({ code }) => code !== item.code))}>Bỏ dòng lỗi</button>}
    </div>)}
    {!disabled && <button type="button" className="gs-btn gs-btn-secondary" disabled={items.length >= 30} onClick={add}>Thêm lỗi hiện trạng</button>}
  </fieldset>;
}
