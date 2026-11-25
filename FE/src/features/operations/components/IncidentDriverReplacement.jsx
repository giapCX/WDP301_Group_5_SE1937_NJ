import useOperations from '../hooks/useOperations';
import { ActionForm, Feedback } from './OperationShared';
export default function IncidentDriverReplacement({ incident, onDone }) {
  const result = useOperations('/operator/dispatch');
  return <><Feedback error={result.error}/><ActionForm title="Phân công tài xế thay thế đã được duyệt" path={'/operator/operations/incidents/' + incident.incident_id + '/replace-driver'} transform={(fields) => ({ driver_id: Number(fields.driver_id) })} onDone={onDone}>
    <label>Tài xế thay thế<select required name="driver_id"><option value="">Chọn tài xế</option>{result.data?.drivers?.map((driver) => <option key={driver.driver_id} value={driver.driver_id} disabled={!driver.approved || driver.status !== 'active'}>{driver.full_name} · {driver.availability_status}</option>)}</select></label><p>Backend kiểm tra lại lịch, bằng lái và điều kiện xe. Tài xế mới cần nhận phân công trong dashboard Driver.</p>
  </ActionForm></>;
}
