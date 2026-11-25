import { useState } from 'react';
import useOperations from '../hooks/useOperations';
import { ActionForm, History, Feedback, labels } from './OperationShared';
import { money } from '../../bookings/bookingConstants';
export const chargeTypes = { overtime: 'Quá giờ', extra_km: 'Vượt km', waiting: 'Chờ khách', other: 'Khác' };
export function ChargeFields({ record = {} }) { return <><div className="op-grid"><label>Loại phí<select name="type" defaultValue={record.type || 'overtime'}>{Object.entries(chargeTypes).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
  <label>Số lượng<input name="quantity" type="number" required min="0.001" step="0.001" defaultValue={record.quantity || 1}/></label>
  <label>Đơn giá (₫)<input name="unit_price" type="number" required min="1" step="1" defaultValue={record.unit_price || ''}/></label></div>
  <label>Mô tả khoản phí<textarea name="description" required maxLength={2000} defaultValue={record.description}/></label>
  <label>Bằng chứng (mỗi dòng một URL HTTPS)<textarea name="evidence" defaultValue={record.evidence?.join('\n')}/></label></>; }
export const chargePayload = (fields) => ({ ...fields, quantity: Number(fields.quantity), unit_price: Number(fields.unit_price), evidence: fields.evidence?.split('\n').map((item) => item.trim()).filter(Boolean) || [] });
export default function ChargeCard({ record, renter, onDone }) {
  const [open, setOpen] = useState(false);
  const base = `/${renter ? 'renter' : 'operator'}/bookings/${record.booking_id}/additional-charges/${record.charge_id}`;
  const detail = useOperations(open ? base : null);
  const charge = detail.data?.charge || record;
  const done = () => { detail.refresh(); onDone?.(); };
  return <article className="op-card"><h3>Đơn #{record.booking_id} · {chargeTypes[charge.type]}</h3><p>{charge.description}</p><p>{charge.quantity} × {money(charge.unit_price)} = <strong>{money(charge.amount)}</strong> · {labels[charge.status]}</p>
    <button className="dispatch-button subtle" onClick={() => setOpen(!open)}>{open ? 'Thu gọn' : 'Chi tiết và thao tác'}</button>
    {open && <><Feedback error={detail.error}/>{detail.loading && <p role="status">Đang tải…</p>}<div className="op-evidence">{charge.evidence?.map((url, index) => <a key={index} href={url} target="_blank" rel="noreferrer">Bằng chứng {index + 1}</a>)}</div><History items={charge.history}/>
      {!renter && charge.status === 'draft' && <>
        <ActionForm title="Sửa khoản phí nháp" path={base} method="patch" transform={chargePayload} onDone={done}><ChargeFields record={charge}/></ActionForm>
        <ActionForm title="Xác nhận khoản phí" path={base + '/confirm'} method="patch" onDone={done}/></>}
      {!renter && ['draft', 'confirmed'].includes(charge.status) && <ActionForm title="Hủy khoản phí" path={base + '/cancel'} method="patch" onDone={done}/>}
      {!renter && charge.status === 'disputed' && <ActionForm title="Giải quyết tranh chấp" path={base + '/resolve-dispute'} method="patch" onDone={done}><label>Kết quả<select name="resolution"><option value="waive">Miễn khoản phí</option><option value="uphold">Giữ khoản phí</option></select></label></ActionForm>}
      {renter && charge.status === 'confirmed' && <ActionForm title="Khiếu nại khoản phí" path={base + '/dispute'} onDone={done} transform={(fields) => ({ evidence: fields.evidence?.split('\n').filter(Boolean) || [] })}><label>Bằng chứng (URL HTTPS mỗi dòng)<textarea name="evidence"/></label></ActionForm>}
    </>}
  </article>;
}
