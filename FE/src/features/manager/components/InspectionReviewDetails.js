import GaragePhotoPreview from '../../garage/components/GaragePhotoPreview';

const conditions = { good: 'Tốt', attention: 'Cần chú ý', damaged: 'Hư hỏng' };

export default function InspectionReviewDetails({ inspection }) {
  if (!inspection) return null;
  const report = inspection.conditionReport || {};
  return <div className="inspection-review-details">
    <dl>
      <div><dt>Số km</dt><dd>{report.odometer_km ?? '—'} km</dd></div>
      <div><dt>Nhiên liệu / pin</dt><dd>{report.fuel_level_pct ?? '—'}%</dd></div>
      {[['exterior', 'Ngoại thất'], ['interior', 'Nội thất'], ['engine', 'Động cơ'], ['tires', 'Lốp xe']].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{conditions[report[key]] || report[key] || '—'}</dd></div>)}
    </dl>
    <p><strong>Ghi chú Garage: </strong>{report.note || 'Không có ghi chú.'}</p>
    {inspection.decisionReason && <p><strong>Quyết định trước đó: </strong>{inspection.decisionReason}</p>}
    <div className="gs-photo-grid">
      {(report.photo_keys || []).map((key) => <div key={key}><GaragePhotoPreview photo={{ key, name: key.split('/').at(-1) }} /></div>)}
    </div>
    {!report.photo_keys?.length && <small>Biên bản không có ảnh đính kèm.</small>}
  </div>;
}
