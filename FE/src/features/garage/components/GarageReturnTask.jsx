import { dateTime } from '../../bookings/bookingConstants';
import GarageDamageReport from './GarageDamageReport';
import GarageInspectionForm from './GarageInspectionForm';
import GarageReturnComparison from './GarageReturnComparison';

export default function GarageReturnTask({ task, onSave, onRefresh }) {
  const before = task.before_inspection;
  const after = task.inspection;
  const failed = ['failed', 'fail'].includes(after?.result);

  return (
    <>
      <GarageReturnComparison before={before} after={after} />
      {Number.isFinite(task.reported_odometer) && <p>Số km tài xế báo cuối chuyến: {task.reported_odometer} km.</p>}
      {!after && !task.archived && (
        <GarageInspectionForm returning onSave={onSave} minOdometer={before?.odometer ?? 0} />
      )}
      {after && (
        <div className="garage-check-actions">
          <div>
            <p>{failed ? 'Tiếp nhận không đạt. Xe được đưa vào bảo dưỡng.' : 'Tiếp nhận đạt.'}</p>
            {task.confirmed_at
              ? <p>Tài xế xác nhận trả xe lúc {dateTime(task.confirmed_at)}.</p>
              : !task.archived && <p>Chờ tài xế xác nhận đã trả xe.</p>}
          </div>
          {!task.archived && <button className="dispatch-button subtle" onClick={onRefresh}>Làm mới trạng thái</button>}
        </div>
      )}
      {failed && <GarageDamageReport inspection={after} report={task.damage_report} onUpdate={onRefresh} />}
    </>
  );
}
