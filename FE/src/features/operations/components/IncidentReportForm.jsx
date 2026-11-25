import { ActionForm } from './OperationShared';
export default function IncidentReportForm({ path, onDone }) {
  return <ActionForm title="Báo sự cố / khiếu nại" path={path} reasonKey="description" transform={(fields) => ({ ...fields, evidence: fields.evidence?.split('\n').map((item) => item.trim()).filter(Boolean) || [] })} onDone={onDone} label="Gửi báo cáo"><label>Loại sự cố<select name="kind"><option value="other">Khác</option><option value="complaint">Khiếu nại dịch vụ</option><option value="vehicle_failure">Hỏng xe</option><option value="accident">Tai nạn</option><option value="customer_route_change">Thay đổi hành trình</option></select></label><label>Bằng chứng (mỗi dòng một URL HTTPS)<textarea name="evidence"/></label></ActionForm>;
}
