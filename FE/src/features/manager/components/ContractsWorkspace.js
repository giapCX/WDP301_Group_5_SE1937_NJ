import { saveErrorMessage } from '../../../services/saveErrorMessage';
import CopyCode from '../../../components/ui/CopyCode';
import Modal from '../../../components/ui/Modal';
import Pagination from "../../../components/ui/Pagination";
import { useState } from 'react';
import ContractsPage from '../../contracts/ContractsPage';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';
import { DataFields, formatDisplayValue, humanizeField } from './dataDisplay';
function termFields(terms, path = []) {
  return Object.entries(terms ?? {}).flatMap(([key, value]) => {
    const fieldPath = [...path, key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return termFields(value, fieldPath);
    if (!['boolean', 'number', 'string'].includes(typeof value)) return [];
    return [{ path: fieldPath, name: JSON.stringify(fieldPath), label: fieldPath.map(humanizeField).join(' · '), value }];
  });
}

export default function ContractsWorkspace({
  onNotice
}) {
  const [contractType, setContractType] = useState('management');
  const [panel, setPanel] = useState('signing');
  const request = useManagerCollection('contracts', {
    type: contractType
  });
  const {
    updateContract
  } = useManagerActions();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const {
    data: contracts,
    loading
  } = request;
  const error = request.error;
  const refresh = request.refresh;
  const labels = { review: 'Ghi nhận rà soát', amend: 'Đề nghị sửa đổi', terminate: 'Chấm dứt hợp đồng' };

  function openAction(item, action) {
    setFormError('');
    setEditing({ item, action });
  }

  const editableTerms = termFields(editing?.item.terms);

  async function submitAction(event) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const { item, action } = editing;
    const reason = form.get('reason').trim();
    const note = form.get('note')?.trim();
    if (!reason || (action === 'review' && !note)) {
      setFormError('Vui lòng điền lý do và các thông tin bắt buộc.');
      return;
    }
    const body = { action, reason };
    if (action === 'review') body.note = note;
    if (action === 'amend') {
      body.proposedTerms = JSON.parse(JSON.stringify(item.terms));
      let changed = false;
      for (const field of editableTerms) {
        const raw = form.get(field.name);
        const value = typeof field.value === 'boolean' ? raw === 'true' : typeof field.value === 'number' ? Number(raw) : raw.trim();
        if (value === field.value) continue;
        const parent = field.path.slice(0, -1).reduce((object, key) => object[key], body.proposedTerms);
        parent[field.path.at(-1)] = value;
        changed = true;
      }
      if (!changed) {
        setFormError('Hãy sửa ít nhất một điều khoản trước khi gửi đề nghị.');
        return;
      }
    }
    setSaving(true);
    setFormError('');
    try {
      await updateContract(contractType, item.id, body);
      setEditing(null);
      onNotice({ review: 'Đã lưu kết quả rà soát hợp đồng.', amend: 'Đã gửi đề nghị sửa đổi chờ chữ ký.', terminate: 'Đã chấm dứt hợp đồng quản lý.' }[action]);
      refresh();
    } catch (reason) {
      setFormError(saveErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
  if (panel === 'signing') return <section className="manager-panel workspace-panel manager-contract-signing-panel">
    <div className="workspace-header"><div><h2>Lập nội dung và ký hợp đồng</h2><p>Chuẩn bị hợp đồng quản lý xe và ký riêng phía nền tảng tại đây.</p></div><button className="action-review" onClick={() => { request.refresh(); setPanel('records'); }}>Xem hồ sơ và phụ lục</button></div>
    <ContractsPage embedded />
  </section>;
  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải dữ liệu…</p><Pagination {...request.paging} /></section>;
  if (error) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{error}<button onClick={refresh}>Thử lại</button></div><Pagination {...request.paging} /></section>;
  return <section className="manager-panel workspace-panel">
    <div className="workspace-header"><div><h2>Quản lý hợp đồng</h2><p>Theo dõi hiệu lực, rà soát điều khoản và đề xuất phụ lục chờ chữ ký.</p></div><button className="manager-primary" onClick={() => setPanel('signing')}>＋ Lập & ký hợp đồng</button></div>
    <label className="manager-period"><select value={contractType} onChange={event => setContractType(event.target.value)} aria-label="Loại hợp đồng"><option value="management">Hợp đồng quản lý xe</option><option value="rental">Hợp đồng thuê xe</option></select></label>
    <div className="requests-table-wrap" tabIndex={0} role="region" aria-label="Danh sách hợp đồng"><table className="requests-table"><thead><tr><th>MÃ HỢP ĐỒNG</th><th>TRẠNG THÁI</th><th>ĐIỀU KHOẢN HIỆN TẠI</th><th>PHỤ LỤC CHỜ KÝ</th><th>THAO TÁC</th></tr></thead><tbody>{contracts.map(item => <tr key={item.id}><td><strong><CopyCode value={item.number || item.id} label="mã hợp đồng" /></strong><span>{item.signedAt ? new Date(item.signedAt).toLocaleDateString('vi-VN') : 'Chưa ký'}</span></td><td><span className={`contract-status ${item.status}`}>{formatDisplayValue(item.status, 'status')}</span></td><td><DataFields className="contract-term-fields" data={item.terms} /></td><td><span className="amendment-count">{(item.amendments || []).filter(amendment => amendment.status === 'pending_signatures').length}</span><span>chờ chữ ký</span></td><td><div className="workspace-actions"><button className="action-review" onClick={() => openAction(item, 'review')}>Ghi nhận rà soát</button>
      <button className="action-review" onClick={() => openAction(item, 'amend')}>Đề nghị sửa đổi</button>
      {contractType === 'management' && item.status === 'active' && <button className="action-reject" onClick={() => openAction(item, 'terminate')}>Chấm dứt</button>}</div></td></tr>)}</tbody></table>{!contracts.length && <p className="manager-empty">Không có hợp đồng.</p>}</div>
  <Pagination {...request.paging} />
  {editing && <Modal title={labels[editing.action]} onClose={() => { if (!saving) setEditing(null); }}>
    <form className="manager-action-form" onSubmit={submitAction}>
      <p><CopyCode value={editing.item.number || editing.item.id} label="mã hợp đồng" /></p>
      <label>Lý do<textarea name="reason" required maxLength={1000} rows={3} disabled={saving} /></label>
      {editing.action === 'review' && <label>Kết quả rà soát<textarea name="note" required maxLength={1000} rows={3} disabled={saving} /></label>}
      {editing.action === 'amend' && (editableTerms.length ? <fieldset className="manager-term-editor">
        <legend>Điều khoản đề xuất</legend>
        {editableTerms.map(({ name, label, value }) => <label key={name}>{label}
          {typeof value === 'boolean'
            ? <select name={name} defaultValue={String(value)} disabled={saving}><option value="true">Có</option><option value="false">Không</option></select>
            : <input name={name} type={typeof value === 'number' ? 'number' : 'text'} step="any" defaultValue={value} required={typeof value === 'number'} disabled={saving} />}
        </label>)}
      </fieldset> : <p>Hợp đồng chưa có điều khoản có thể chỉnh sửa tại đây.</p>)}
      {formError && <p role="alert">{formError}</p>}
      <button className="manager-primary" type="submit" disabled={saving || (editing.action === 'amend' && !editableTerms.length)}>{saving ? 'Đang lưu…' : labels[editing.action]}</button>
    </form>
  </Modal>}
  </section>;
}
