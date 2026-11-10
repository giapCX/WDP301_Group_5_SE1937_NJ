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
  const [panel, setPanel] = useState('records');
  const request = useManagerCollection('contracts', {
    type: contractType
  });
  const {
    updateContract
  } = useManagerActions();
  const [actionError, setActionError] = useState('');
  const {
    data: contracts,
    loading
  } = request;
  const error = actionError || request.error;
  const refresh = () => {
    setActionError('');
    request.refresh();
  };
  const act = async (promise, successText) => {
    try {
      await promise;
      onNotice(successText);
      refresh();
    } catch (reason) {
      setActionError(reason.message || 'Không thể cập nhật hợp đồng.');
    }
  };
  if (panel === 'signing') return <section className="manager-panel workspace-panel manager-contract-signing-panel">
    <div className="workspace-header"><div><h2>Lập nội dung và ký hợp đồng</h2><p>Chuẩn bị hợp đồng quản lý xe và ký riêng phía nền tảng tại đây.</p></div><button className="action-review" onClick={() => { request.refresh(); setPanel('records'); }}>← Danh sách hợp đồng</button></div>
    <ContractsPage embedded />
  </section>;
  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải dữ liệu…</p><Pagination {...request.paging} /></section>;
  if (error) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{error}<button onClick={refresh}>Thử lại</button></div><Pagination {...request.paging} /></section>;
  return <section className="manager-panel workspace-panel">
    <div className="workspace-header"><div><h2>Quản lý hợp đồng</h2><p>Theo dõi hiệu lực, rà soát điều khoản và đề xuất amendment chờ chữ ký.</p></div><button className="manager-primary" onClick={() => setPanel('signing')}>＋ Lập & ký hợp đồng</button></div>
    <label className="manager-period"><select value={contractType} onChange={event => setContractType(event.target.value)} aria-label="Loại hợp đồng"><option value="management">Hợp đồng quản lý xe</option><option value="rental">Hợp đồng thuê xe</option></select></label>
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>MÃ HỢP ĐỒNG</th><th>TRẠNG THÁI</th><th>ĐIỀU KHOẢN HIỆN TẠI</th><th>AMENDMENT CHỜ KÝ</th><th>THAO TÁC</th></tr></thead><tbody>{contracts.map(item => <tr key={item.id}><td><strong>{item.number}</strong><span>{item.signedAt ? new Date(item.signedAt).toLocaleDateString('vi-VN') : 'Chưa ký'}</span></td><td><span className={`contract-status ${item.status}`}>{formatDisplayValue(item.status, 'status')}</span></td><td><DataFields className="contract-term-fields" data={item.terms} /></td><td><span className="amendment-count">{(item.amendments || []).filter(amendment => amendment.status === 'pending_signatures').length}</span><span>chờ chữ ký</span></td><td><div className="workspace-actions"><button className="action-review" onClick={() => {
                  const reason = window.prompt('Lý do rà soát:');
                  if (!reason) return;
                  const note = window.prompt('Kết quả rà soát:');
                  if (note) act(updateContract(contractType, item.id, {
                    action: 'review',
                    reason,
                    note
                  }), 'Đã lưu kết quả rà soát hợp đồng.');
                }}>Ghi nhận rà soát</button><button className="action-review" onClick={() => {
                  const reason = window.prompt('Lý do đề nghị sửa đổi:');
                  if (!reason) return;
                  const raw = window.prompt('Điều khoản đề xuất dạng JSON:', JSON.stringify(item.terms, null, 2));
                  if (!raw) return;
                  try {
                    act(updateContract(contractType, item.id, {
                      action: 'amend',
                      reason,
                      proposedTerms: JSON.parse(raw)
                    }), 'Đã gửi đề nghị sửa đổi chờ chữ ký.');
                  } catch {
                    setActionError('Điều khoản phải là JSON hợp lệ.');
                  }
                }}>Đề nghị sửa đổi</button>{contractType === 'management' && item.status === 'active' && <button className="action-reject" onClick={() => {
                  const reason = window.prompt('Lý do chấm dứt hợp đồng:');
                  if (reason) act(updateContract(contractType, item.id, {
                    action: 'terminate',
                    reason
                  }), 'Đã chấm dứt hợp đồng quản lý.');
                }}>Chấm dứt</button>}</div></td></tr>)}</tbody></table>{!contracts.length && <p className="manager-empty">Không có hợp đồng.</p>}</div>
  <Pagination {...request.paging} /></section>;
}
