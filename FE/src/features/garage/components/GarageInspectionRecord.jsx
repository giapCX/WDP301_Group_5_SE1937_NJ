import { dateTime } from '../../bookings/bookingConstants';
import { inspectionPhotoUrl } from '../api/garageApi';
import { CHECKLIST_ITEMS, INSPECTION_RESULTS } from '../garageConstants';

export function InspectionPhotos({ inspection, photoUrl = inspectionPhotoUrl }) {
  if (!inspection?.photo_count) return null;
  return (
    <ul className="garage-check-photos">
      {Array.from({ length: inspection.photo_count }, (_, index) => {
        const link = photoUrl(inspection.inspection_id, index + 1);
        return <li key={link}><a href={link} target="_blank" rel="noreferrer">Xem ảnh {index + 1}</a></li>;
      })}
    </ul>
  );
}

export default function GarageInspectionRecord({ inspection, photoUrl = inspectionPhotoUrl }) {
  return (
    <>
      <p className="garage-check-summary">
        <strong>{INSPECTION_RESULTS[inspection.result]}</strong>
        <span>{dateTime(inspection.inspected_at)}</span>
      </p>
      <dl className="garage-check-values">
        <div><dt>Số km</dt><dd>{inspection.odometer ?? 'Chưa ghi nhận'}</dd></div>
        <div><dt>Nhiên liệu</dt><dd>{inspection.fuel_percent == null ? 'Chưa ghi nhận' : inspection.fuel_percent + '%'}</dd></div>
      </dl>
      {inspection.checklist ? (
        <ul className="garage-check-items">
          {CHECKLIST_ITEMS.map(([key, label]) => (
            <li key={key}><span>{label}</span><strong>{INSPECTION_RESULTS[inspection.checklist[key]] || 'Chưa ghi nhận'}</strong></li>
          ))}
        </ul>
      ) : <p className="garage-check-hint">Hồ sơ này chưa ghi nhận từng hạng mục kiểm tra.</p>}
      {inspection.condition_note && <p className="garage-check-note">{inspection.condition_note}</p>}
      <InspectionPhotos inspection={inspection} photoUrl={photoUrl} />
    </>
  );
}
