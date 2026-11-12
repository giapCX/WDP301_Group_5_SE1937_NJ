import GaragePhotoPreview from '../../garage/components/GaragePhotoPreview';

import InspectionChecklistResults from '../../garage/components/InspectionChecklistResults';

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
    <p>Mã biên bản {inspection.id} · Phiên bản {inspection.version ?? '—'}</p>
    {report.checklist && <p><strong>Phản hồi chủ xe: </strong>{inspection.ownerReview?.status === 'accepted'
      ? 'Đã xác nhận hiện trạng' : inspection.ownerReview?.status === 'disputed' ? 'Có bất đồng' : 'Chưa phản hồi'}
      {inspection.ownerReview?.note && ` · ${inspection.ownerReview.note}`}</p>}
    <InspectionChecklistResults items={report.checklist} />
    <p><strong>Ghi chú Garage: </strong>{report.note || 'Không có ghi chú.'}</p>
    {inspection.decisionReason && <p><strong>Quyết định trước đó: </strong>{inspection.decisionReason}</p>}
    <div className="gs-photo-grid">
      {(report.photo_keys || []).map((key) => <div key={key}><GaragePhotoPreview photo={{ key, name: key.split('/').at(-1) }} /></div>)}
    </div>
    {!report.photo_keys?.length && <small>Biên bản không có ảnh đính kèm.</small>}
  </div>;
}
