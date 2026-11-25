import { useState } from 'react';
import { operationAction, operationError } from '../api/operationsApi';
import { dateTime, money } from '../../bookings/bookingConstants';
export const labels = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối', open: 'Đang mở', resolved: 'Đã xử lý', completed: 'Đã hoàn tiền', draft: 'Nháp', confirmed: 'Đã xác nhận', disputed: 'Đang tranh chấp', cancelled: 'Đã hủy' };
const eventNames = { requested: 'Yêu cầu hoàn tiền', approve: 'Phê duyệt', reject: 'Từ chối', complete: 'Hoàn tiền mô phỏng', reported: 'Báo sự cố', resolved: 'Đã xử lý', approval_requested: 'Trình Manager', manager_approve: 'Manager phê duyệt', manager_reject: 'Manager từ chối', cancellation_requested: 'Yêu cầu hủy', cancellation_approved: 'Duyệt hủy', cancellation_rejected: 'Từ chối hủy', refund_pending: 'Chờ duyệt hoàn tiền', refund_approved: 'Duyệt hoàn tiền', refund_rejected: 'Từ chối hoàn tiền', refund_completed: 'Đã hoàn mô phỏng', change_requested: 'Đề xuất đổi lịch', change_price_offered: 'Gửi giá thay đổi', change_rejected: 'Từ chối đổi lịch', change_approved: 'Áp dụng lịch mới', incident_reported: 'Báo sự cố', incident_resolved: 'Đóng sự cố', incident_approval_requested: 'Trình phương án xử lý', incident_manager_approve: 'Duyệt phương án xử lý', incident_manager_reject: 'Từ chối phương án', charge_create: 'Tạo phụ phí', charge_update: 'Sửa phụ phí', charge_confirm: 'Xác nhận phụ phí', charge_dispute: 'Khiếu nại phụ phí', charge_resolve: 'Giải quyết khiếu nại', charge_cancel: 'Hủy phụ phí', create: 'Tạo khoản phí', update: 'Cập nhật khoản phí', confirm: 'Xác nhận khoản phí', cancel: 'Hủy khoản phí', dispute: 'Tranh chấp', resolve_uphold: 'Giữ khoản phí', resolve_waive: 'Miễn khoản phí' };
export function History({ items = [] }) {
  return <details className="op-history"><summary>Lịch sử xử lý ({items.length})</summary><ol>{items.map((item, index) => <li key={index}><strong>{eventNames[item.action] || 'Cập nhật xử lý'}</strong> · #{item.actor_id} · {dateTime(item.at || item.created_at)}<p>{item.note}</p></li>)}</ol></details>;
}
export function Feedback({ error, message }) { return <>{error && <p role="alert" className="dispatch-alert">{error}</p>}{message && <p role="status" className="op-success">{message}</p>}</>; }
export function ActionForm({ title, path, payload = {}, method = 'post', onDone, children, label = 'Xác nhận', reasonKey = 'reason', transform = (fields) => fields }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reason, setReason] = useState('');
  return <form className="op-form" onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try { await operationAction(path, { ...transform(fields), ...payload, [reasonKey]: reason }, method); setReason(''); onDone?.(); }
    catch (failure) { setError(operationError(failure)); } finally { setBusy(false); }
  }}><h3>{title}</h3><fieldset disabled={busy}>{children}<label>Lý do / nội dung xử lý<textarea required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)}/></label>
    <Feedback error={error}/><button className="dispatch-button primary" disabled={busy}>{busy ? 'Đang xử lý…' : label}</button></fieldset></form>;
}
export function Pager({ page, totalPages, onChange }) { return <nav className="op-actions" aria-label="Phân trang"><button className="dispatch-button subtle" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</button><span>Trang {page}/{Math.max(1, totalPages || 0)}</span><button className="dispatch-button subtle" disabled={page >= (totalPages || 0)} onClick={() => onChange(page + 1)}>Sau</button></nav>; }
export function RefundCard({ record, manager, onDone }) {
  const base = '/manager/operation-approvals/refunds/' + record.refund_id + '/decision';
  return <article className="op-card"><h3>Hoàn tiền #{record.refund_id} · Đơn #{record.booking_id || '—'}</h3><p>{labels[record.refund_status]} · <strong>{money(record.amount)}</strong> · Giao dịch #{record.payment_id}</p><p>{record.reason}</p>
    {record.decision_note && <p>Quyết định: {record.decision_note}</p>}{record.provider_reference && <p>Mã mô phỏng: {record.provider_reference}</p>}
    <History items={record.history}/>{manager && record.refund_status === 'pending' && <ActionForm title="Phê duyệt hoàn tiền" path={base} onDone={onDone}><label>Quyết định<select name="decision"><option value="approve">Duyệt</option><option value="reject">Từ chối</option></select></label></ActionForm>}
    {manager && record.refund_status === 'approved' && <ActionForm title="Hoàn tiền mô phỏng (không chuyển tiền thật)" path={base} payload={{ decision: 'complete' }} label="Xác nhận hoàn mô phỏng" onDone={onDone}/>}
  </article>;
}
