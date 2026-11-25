import IncidentDriverReplacement from './IncidentDriverReplacement';
import { Link } from 'react-router-dom';
import { ActionForm, History, labels } from './OperationShared';
import { dateTime, money } from '../../shared/booking/bookingConstants';
const actionLabels = { support: 'Hỗ trợ khách', compensation: 'Bồi thường / hoàn tiền', replace_vehicle: 'Đổi xe', replace_driver: 'Đổi tài xế', change_itinerary: 'Điều chỉnh lịch trình' };
export default function IncidentCard({ record, manager, renter, onDone }) {
  const proposal = record.resolution_approval;
  return <article className="op-card"><h3>Sự cố #{record.incident_id} · Đơn #{record.booking_id}</h3><p>{labels[record.incident_status]} · {record.kind || 'other'} · {dateTime(record.reported_at)}</p><p>{record.description}</p>
    <div className="op-evidence">{record.evidence?.map((url, index) => <a key={index} href={url} target="_blank" rel="noreferrer">Bằng chứng {index + 1}</a>)}</div>
    {record.garage_damage_inspection_id && !renter && <p>Hồ sơ hư hỏng Gara #{record.garage_damage_inspection_id}. <Link to="/operator/dispatch">Xem ảnh và phối hợp điều phối</Link></p>}
    {proposal?.id && <div className="op-totals"><p>Phương án: {actionLabels[proposal.action]} · {labels[proposal.status]}</p><p>{proposal.note} {proposal.amount > 0 && money(proposal.amount)}</p>{proposal.decision_note && <p>Manager: {proposal.decision_note}</p>}</div>}
    {record.resolution_note && <p>Kết quả: {record.resolution_note}</p>}<History items={record.history}/>
    {manager && proposal?.status === 'pending' && record.incident_status === 'open' && <ActionForm title="Phê duyệt phương án" path={'/manager/operation-approvals/incidents/' + record.incident_id + '/decision'} payload={{ proposalId: proposal.id }} onDone={onDone}><label>Quyết định<select name="decision"><option value="approve">Duyệt</option><option value="reject">Từ chối, yêu cầu đề xuất lại</option></select></label></ActionForm>}
    {!manager && !renter && record.incident_status === 'open' && <>
      {!['pending', 'approved'].includes(proposal?.status) && <ActionForm title="Trình Manager phương án xử lý" path={'/operator/operations/incidents/' + record.incident_id + '/proposal'} reasonKey="note" transform={(fields) => ({ ...fields, amount: Number(fields.amount) })} onDone={onDone}><label>Phương án<select name="action">{Object.entries(actionLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Số tiền bồi thường đề xuất (₫, phương án khác nhập 0)<input name="amount" type="number" required min="0" step="1" defaultValue="0"/></label></ActionForm>}
      <p className="op-actions"><Link to="/operator/dispatch">Phối hợp đổi xe / tài xế</Link><Link to="/operator/booking-change-requests">Xử lý đổi lịch trình</Link></p>
      {proposal?.status === 'approved' && proposal.action === 'replace_driver' && <IncidentDriverReplacement incident={record} onDone={onDone}/>}
      {proposal?.status !== 'pending' && <ActionForm title="Ghi nhận đã xử lý và đóng sự cố" path={'/operator/operations/incidents/' + record.incident_id + '/resolve'} onDone={onDone}/>}
    </>}
  </article>;
}
