import { useState } from 'react';
import { getBlobApi } from '../../../services/httpClient';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';

const status = { pending: 'Chờ xét duyệt', verified: 'Đã xác minh', revision_required: 'Cần bổ sung', rejected: 'Không đạt', unverified: 'Chưa gửi' };

export default function IdentityVerificationWorkspace({ onNotice }) {
  const request = useManagerCollection('identityVerifications');
  const { reviewIdentityVerification } = useManagerActions();
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const openDocument = async (item, kind) => {
    setActionError('');
    try {
      const blob = await getBlobApi(`/manager/identity-verifications/${item.id}/documents/${kind}`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setActionError(error.message || 'Không thể tải tài liệu private.'); }
  };
  const act = async (item, action, note = '') => {
    setBusyId(item.id); setActionError('');
    try {
      await reviewIdentityVerification(item.id, { action, note });
      onNotice(action === 'approve' ? 'Đã xác minh danh tính và bằng lái.' : action === 'revision' ? 'Đã yêu cầu khách thuê bổ sung hồ sơ.' : 'Đã từ chối hồ sơ eKYC.');
      request.refresh();
    } catch (error) { setActionError(error.message || 'Không thể cập nhật hồ sơ eKYC.'); }
    finally { setBusyId(''); }
  };
  const ask = (item, action) => {
    const note = window.prompt(action === 'revision' ? `Nội dung cần bổ sung cho ${item.name}:` : `Lý do từ chối hồ sơ của ${item.name}:`);
    if (note === null) return;
    if (note.trim().length < 5) return setActionError('Lý do hoặc nội dung bổ sung cần ít nhất 5 ký tự.');
    act(item, action, note.trim());
  };
  if (request.loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải hồ sơ eKYC…</p></section>;
  return <section className="manager-panel workspace-panel"><div className="workspace-header"><div><h2>eKYC Chủ xe và Người thuê</h2><p>Operator kiểm tra tính đầy đủ trước; Manager đối chiếu tài liệu và quyết định xác minh cuối.</p></div><span className="workspace-count">{request.data.length} hồ sơ</span></div>{(actionError || request.error) && <div className="manager-notice manager-error">{actionError || request.error}<button onClick={() => { setActionError(''); request.refresh(); }}>Thử lại</button></div>}<div className="vehicle-approval-list">{request.data.map((item) => <article className="vehicle-approval-card" key={item.id}><header className="vehicle-card-header"><div><span className="vehicle-card-kicker">HỒ SƠ eKYC · {item.id.slice(-6).toUpperCase()}</span><h3>{item.name}</h3><p>{item.email || '—'} <span>·</span> {item.phone || '—'}</p></div><span className="vehicle-review-status">{status[item.identity.status] || item.identity.status}</span></header><div className="vehicle-review-grid"><section><h4>Định danh</h4><p><strong>{item.identity.documentType === 'passport' ? 'Hộ chiếu' : 'CCCD'}</strong></p><p>{item.identity.idMasked || '—'}</p><button className="manager-inline-button" onClick={() => openDocument(item, 'identity')}>Mở tài liệu</button></section><section><h4>Giấy phép lái xe</h4><p><strong>Hạng {item.driverLicense.class || '—'}</strong></p><p>{item.driverLicense.licenseMasked || '—'} · hết hạn {item.driverLicense.expiresAt ? new Date(item.driverLicense.expiresAt).toLocaleDateString('vi-VN') : '—'}</p><button className="manager-inline-button" onClick={() => openDocument(item, 'license')}>Mở bằng lái</button></section></div><p>Operator precheck · {item.operatorPrecheck?.status === 'ready' ? 'Đủ hồ sơ' : item.operatorPrecheck?.status === 'needs_revision' ? 'Đề nghị bổ sung' : 'Chưa kiểm tra'}{item.operatorPrecheck?.note && ` · ${item.operatorPrecheck.note}`}</p><footer className="vehicle-card-actions"><button className="action-approve" disabled={busyId === item.id || item.operatorPrecheck?.status !== 'ready'} onClick={() => act(item, 'approve')}>{busyId === item.id ? 'Đang lưu…' : 'Xác minh hồ sơ'}</button><button className="action-review" disabled={busyId === item.id} onClick={() => ask(item, 'revision')}>Yêu cầu bổ sung</button><button className="action-reject" disabled={busyId === item.id} onClick={() => ask(item, 'reject')}>Từ chối</button></footer></article>)}</div>{!request.data.length && <p className="manager-empty">Không có hồ sơ eKYC chờ xét duyệt.</p>}</section>;
}
