import Modal from '../../../components/ui/Modal';
import Pagination from "../../../components/ui/Pagination";
import { useState } from 'react';
import ContractsPage from '../../contracts/ContractsPage';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';
import { DataFields, formatDisplayValue } from './dataDisplay';
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
      try {
        const terms = JSON.parse(form.get('terms'));
        if (!terms || typeof terms !== 'object' || Array.isArray(terms)) throw new Error();
        body.proposedTerms = terms;
      } catch {
        setFormError('Điều khoản phải là một đối tượng JSON hợp lệ.');
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
      setFormError(reason.message || 'Không thể cập nhật hợp đồng.');
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
    <div className="workspace-header"><div><h2>Quản lý hợp đồng</h2><p>Theo dõi hiệu lực, rà soát điều khoản và đề xuất amendment chờ chữ ký.</p></div><button className="manager-primary" onClick={() => setPanel('signing')}>＋ Lập & ký hợp đồng</button></div>
    <label className="manager-period"><select value={contractType} onChange={event => setContractType(event.target.value)} aria-label="Loại hợp đồng"><option value="management">Hợp đồng quản lý xe</option><option value="rental">Hợp đồng thuê xe</option></select></label>
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>MÃ HỢP ĐỒNG</th><th>TRẠNG THÁI</th><th>ĐIỀU KHOẢN HIỆN TẠI</th><th>AMENDMENT CHỜ KÝ</th><th>THAO TÁC</th></tr></thead><tbody>{contracts.map(item => <tr key={item.id}><td><strong>{item.number}</strong><span>{item.signedAt ? new Date(item.signedAt).toLocaleDateString('vi-VN') : 'Chưa ký'}</span></td><td><span className={`contract-status ${item.status}`}>{formatDisplayValue(item.status, 'status')}</span></td><td><DataFields className="contract-term-fields" data={item.terms} /></td><td><span className="amendment-count">{(item.amendments || []).filter(amendment => amendment.status === 'pending_signatures').length}</span><span>chờ chữ ký</span></td><td><div className="workspace-actions"><button className="action-review" onClick={() => openAction(item, 'review')}>Ghi nhận rà soát</button>
      <button className="action-review" onClick={() => openAction(item, 'amend')}>Đề nghị sửa đổi</button>
      {contractType === 'management' && item.status === 'active' && <button className="action-reject" onClick={() => openAction(item, 'terminate')}>Chấm dứt</button>}</div></td></tr>)}</tbody></table>{!contracts.length && <p className="manager-empty">Không có hợp đồng.</p>}</div>
  <Pagination {...request.paging} />
  {editing && <Modal title={labels[editing.action]} onClose={() => { if (!saving) setEditing(null); }}>
    <form className="contract-sign-form" onSubmit={submitAction}>
      <p>{editing.item.number}</p>
      <label>Lý do<textarea name="reason" required rows={3} disabled={saving} /></label>
      {editing.action === 'review' && <label>Kết quả rà soát<textarea name="note" required rows={3} disabled={saving} /></label>}
      {editing.action === 'amend' && <label>Điều khoản đề xuất (JSON)
        <textarea name="terms" required rows={8} disabled={saving} defaultValue={JSON.stringify(editing.item.terms ?? {}, null, 2)} />
      </label>}
      {formError && <p role="alert">{formError}</p>}
      <button className="manager-primary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : labels[editing.action]}</button>
    </form>
  </Modal>}
  </section>;
}
