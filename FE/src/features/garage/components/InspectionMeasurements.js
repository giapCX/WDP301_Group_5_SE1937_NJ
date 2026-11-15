const fields = [
  ['tire_front_left_kpa', 'Áp suất lốp trước trái', 'kPa'],
  ['tire_front_right_kpa', 'Áp suất lốp trước phải', 'kPa'],
  ['tire_rear_left_kpa', 'Áp suất lốp sau trái', 'kPa'],
  ['tire_rear_right_kpa', 'Áp suất lốp sau phải', 'kPa'],
  ['minimum_tread_mm', 'Độ sâu gai lốp thấp nhất', 'mm'],
  ['minimum_brake_pad_mm', 'Độ dày má phanh còn lại thấp nhất', 'mm'],
  ['auxiliary_battery_v', 'Điện áp ắc quy phụ', 'V'],
];

export default function InspectionMeasurements({ values = {}, onChange, disabled }) {
  if (!onChange) {
    const recorded = fields.filter(([key]) => Number.isFinite(values[key]));
    if (!recorded.length) return null;
    return <section>
      <h3>Thông số kỹ thuật đo thực tế</h3>
      <ul>{recorded.map(([key, label, unit]) => <li key={key}>
        {label} · {values[key].toLocaleString('vi-VN')} {unit}
      </li>)}</ul>
    </section>;
  }

  return <fieldset disabled={disabled}>
    <legend className="gs-form-section-title">Thông số kỹ thuật đo thực tế</legend>
    <p>Để trống mục chưa đo hoặc không áp dụng. Ghi kết quả đánh giá trong checklist.</p>
    <div className="gs-form-grid">{fields.map(([key, label, unit]) => <label key={key}>
      {label} ({unit})
      <input type="number" min="0" step="any" value={values[key] ?? ''}
        onChange={(event) => onChange({ ...values, [key]: event.target.value })} />
    </label>)}</div>
  </fieldset>;
}
