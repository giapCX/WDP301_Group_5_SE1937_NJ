import { Link } from 'react-router-dom';
import { bookingCode } from '../../../shared/booking/bookingConstants';
import { InspectionPhotos } from '../../../garage/components/GarageInspectionRecord';
import { CHECKLIST_LABELS } from '../../../garage/garageConstants';
import { operatorDamagePhotoUrl } from '../api/tripWorkflowApi';

function IncidentAction({ incident, busy, onSelect, onResolve }) {
  if (incident.workflow_stage === 'routed_to_booking_changes') {
    return <Link to="/operator/booking-change-requests">Mở luồng 4</Link>;
  }
  if (incident.workflow_stage === 'vehicle_replacement_required') {
    return <button onClick={() => onSelect(String(incident.booking_id))}>Điều phối xe thay thế</button>;
  }
  return <button disabled={busy} onClick={() => onResolve(incident)}>Ghi nhận xử lý</button>;
}

export default function DispatchIncidents({ items, busy, onSelect, onResolve }) {
  if (!items?.length) return null;
  return (
    <section className="workflow-assign-card">
      <h2>Sự cố cần xử lý</h2>
      {items.map((incident) => (
        <div key={incident.incident_id} className="workflow-incident">
          <div>
            <span>{bookingCode(incident.booking_id)} · {incident.description}</span>
            {incident.damage_report && (
              <>
                <p>Báo cáo Gara · {incident.damage_report.damaged_items.map((key) => CHECKLIST_LABELS[key]).join(', ')}</p>
                <InspectionPhotos inspection={incident.damage_report}
                  photoUrl={(_, index) => operatorDamagePhotoUrl(incident.booking_id, incident.incident_id, index)}
                />
              </>
            )}
          </div>
          <IncidentAction incident={incident} busy={busy} onSelect={onSelect} onResolve={onResolve} />
        </div>
      ))}
    </section>
  );
}
