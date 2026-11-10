import { useState } from 'react';
import GaragePhotoPreview from '../../garage/components/GaragePhotoPreview';

const money = (value) => new Intl.NumberFormat('vi-VN').format(value || 0);
const responseText = { agreed: 'Khách đồng ý', disputed: 'Khách có bất đồng', not_received: 'Chưa nhận phản hồi' };

export default function IncidentReviewCard({ item, reviewCompensation, reviewIncident, act }) {
  const [busy, setBusy] = useState(false);
  const claims = item.compensationClaims || [];
  const pending = claims.findIndex((claim) => !claim.decision || claim.decision === 'pending');
  async function run(work, message) {
    if (busy) return;
    setBusy(true);
    try { await act(work(), message); } finally { setBusy(false); }
  }
  return <article className="incident-card">
    <div className="incident-card-heading"><div><strong>{item.caseNumber} · {item.caseType}</strong><p>{item.description}</p></div><span className="request-status rose">{item.status}</span></div>
    <div className="gs-photo-grid">{(item.evidence || []).filter((evidence) => evidence.file_key?.startsWith('garage-photos/')).map((evidence) => <div key={evidence.file_key}><GaragePhotoPreview photo={{ key: evidence.file_key, name: evidence.file_key.split('/').at(-1) }} /></div>)}</div>
    {claims.map((claim, index) => <div className="claim-row" key={`${item.id}-${index}`}>
      <div><span>Yêu cầu: {money(claim.requested_amount)} ₫</span>
        {claim.proposed_amount !== undefined && <p>Operation đề xuất: {money(claim.proposed_amount)} ₫</p>}
        {claim.evidence_basis && <p>Căn cứ: {claim.evidence_basis}</p>}
        <p>{responseText[claim.renter_response] || 'Chưa có thông tin phản hồi của khách'}</p>
      </div>
      {claim.decision && claim.decision !== 'pending' ? <span className="claim-decided">{claim.decision === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}</span> : <div className="workspace-actions">
        <button className="action-approve" disabled={busy || index !== pending || item.investigation?.review_status !== 'proposed' || !claim.evidence_basis} onClick={() => {
          const raw = window.prompt('Số tiền bồi thường được duyệt (VND):', String(claim.proposed_amount ?? claim.requested_amount));
          if (raw === null || !raw.trim()) return;
          const amount = Number(raw);
          if (!Number.isSafeInteger(amount) || amount < 0) return;
          const note = window.prompt('Căn cứ quyết định bồi thường của Manager:');
          if (note?.trim()) run(() => reviewCompensation(item.id, { decision: 'approve', amount, note: note.trim(), claimIndex: index }), 'Đã duyệt bồi thường và cập nhật cọc.');
        }}>Duyệt bồi thường</button>
        <button className="action-reject" disabled={busy || index !== pending} onClick={() => {
          const note = window.prompt('Lý do từ chối bồi thường:');
          if (note?.trim()) run(() => reviewCompensation(item.id, { decision: 'reject', note: note.trim(), claimIndex: index }), 'Đã từ chối đề xuất.');
        }}>Từ chối</button>
      </div>}
    </div>)}
    {item.investigation?.review_status !== 'proposed' && <p>Chưa có đề xuất đã xác minh từ Operation. Báo cáo Garage không tự xác lập trách nhiệm bồi thường.</p>}
    {pending < 0 && <button className="action-review" disabled={busy} onClick={() => {
      const note = window.prompt('Kết luận đóng hồ sơ, nêu rõ căn cứ không còn yêu cầu bồi thường:');
      if (note?.trim()) run(() => reviewIncident(item.id, { action: 'resolve', note: note.trim() }), 'Đã đóng hồ sơ. Xe vẫn cần quy trình kiểm tra/sửa chữa nếu đang bảo trì.');
    }}>Kết luận / đóng hồ sơ</button>}
  </article>;
}
