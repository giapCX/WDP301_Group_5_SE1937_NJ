import { useEffect, useState } from 'react';
import { getManagerResource, updateContract } from '../api/managerApi';
import { DataFields, formatDisplayValue } from './dataDisplay';

export default function ContractsWorkspace({ onNotice }) {
  const [contractType, setContractType] = useState('management');
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getManagerResource('contracts', { type: contractType, signal: controller.signal })
      .then((result) => setContracts(result.data || []))
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [contractType, reload]);

  const act = async (promise, successText) => {
    try { await promise; onNotice(successText); setReload((value) => value + 1); }
    catch (reason) { setError(reason.message); }
  };

  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải dữ liệu…</p></section>;
  if (error) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{error}<button onClick={() => setReload((value) => value + 1)}>Thử lại</button></div></section>;

  return <section className="manager-panel workspace-panel">
    <div className="workspace-header"><div><h2>Quản lý hợp đồng</h2><p>Điều chỉnh hợp đồng đã ký bằng amendment chờ chữ ký các bên.</p></div></div>
    <label className="manager-period"><select value={contractType} onChange={(event) => setContractType(event.target.value)} aria-label="Loại hợp đồng"><option value="management">Hợp đồng quản lý xe</option><option value="rental">Hợp đồng thuê xe</option></select></label>
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>MÃ HỢP ĐỒNG</th><th>TRẠNG THÁI</th><th>ĐIỀU KHOẢN HIỆN TẠI</th><th>AMENDMENT CHỜ KÝ</th><th>THAO TÁC</th></tr></thead><tbody>{contracts.map((item) => <tr key={item.id}><td><strong>{item.number}</strong><span>{item.signedAt ? new Date(item.signedAt).toLocaleDateString('vi-VN') : 'Chưa ký'}</span></td><td><span className={`contract-status ${item.status}`}>{formatDisplayValue(item.status, 'status')}</span></td><td><DataFields className="contract-term-fields" data={item.terms} /></td><td><span className="amendment-count">{(item.amendments || []).filter((amendment) => amendment.status === 'pending_signatures').length}</span><span>chờ chữ ký</span></td><td><div className="workspace-actions"><button className="action-review" onClick={() => { const reason = window.prompt('Lý do rà soát:'); if (!reason) return; const note = window.prompt('Kết quả rà soát:'); if (note) act(updateContract(contractType, item.id, { action: 'review', reason, note }), 'Đã lưu kết quả rà soát hợp đồng.'); }}>Ghi nhận rà soát</button><button className="action-review" onClick={() => { const reason = window.prompt('Lý do đề nghị sửa đổi:'); if (!reason) return; const raw = window.prompt('Điều khoản đề xuất dạng JSON:', JSON.stringify(item.terms, null, 2)); if (!raw) return; try { act(updateContract(contractType, item.id, { action: 'amend', reason, proposedTerms: JSON.parse(raw) }), 'Đã gửi đề nghị sửa đổi chờ chữ ký.'); } catch { setError('Điều khoản phải là JSON hợp lệ.'); } }}>Đề nghị sửa đổi</button>{contractType === 'management' && item.status === 'active' && <button className="action-reject" onClick={() => { const reason = window.prompt('Lý do chấm dứt hợp đồng:'); if (reason) act(updateContract(contractType, item.id, { action: 'terminate', reason }), 'Đã chấm dứt hợp đồng quản lý.'); }}>Chấm dứt</button>}</div></td></tr>)}</tbody></table>{!contracts.length && <p className="manager-empty">Không có hợp đồng.</p>}</div>
  </section>;
}
