import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../auth/session';
import ContractContent from './ContractContent';
import { confirmContractIntake, getContract, reviewManagementContract, signContract } from '../api/contractsApi';

export default function SigningDialog({ item, view, onClose, onSigned, readOnly = false }) {
  const [agreement, setAgreement] = useState(null), [error, setError] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const roles = getCurrentUser()?.roles || [];
  const [name, setName] = useState(getCurrentUser()?.full_name || '');
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getContract(item.type, item.id, view, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setAgreement(result.data); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [item.type, item.id, view]);
  useEffect(() => {
    const key = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [busy, onClose]);
  async function sign(event) {
    event.preventDefault(); if (busy || !accepted) return;
    setBusy(true); setError('');
    try {
      const result = await signContract(item.type, item.id, view, { signatureName: name, acceptedTerms: accepted, documentHash: agreement.document.hash });
      setAgreement(result.data); setAccepted(false); onSigned();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function confirmIntake() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await confirmContractIntake(item.type, item.id);
      setAgreement(result.data); onSigned();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function reviewManagement(action) {
    if (busy) return;
    if (action === 'revision' && reviewNote.trim().length < 5) {
      setError('Ghi rõ nội dung cần chỉnh sửa (tối thiểu 5 ký tự).');
      return;
    }
    setBusy(true); setError('');
    try {
      const result = await reviewManagementContract(item.id, { action, note: reviewNote, documentHash: agreement.document.hash });
      setAgreement(result.data); setReviewNote(''); onSigned();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  return <div className="contract-backdrop"><section role="dialog" aria-modal="true" aria-label="Nội dung và ký hợp đồng" className="contract-dialog">
    <div className="contract-dialog-header"><div><span className="contract-eyebrow">XEDI · KÝ KẾT ĐIỆN TỬ</span><h2>Rà soát hợp đồng</h2><p>Đọc kỹ nội dung trước khi xác nhận.</p></div><div className="contract-toolbar">{agreement?.document && !agreement.document.articles?.length && <button className="contract-button contract-button--secondary" onClick={() => window.print()}>In / lưu PDF</button>}<button className="contract-close" onClick={onClose} disabled={busy} autoFocus aria-label="Đóng cửa sổ">×</button></div></div>
    {error && <p className="contract-alert" role="alert">{error}</p>}
    {!agreement ? <div className="contract-loading" role="status"><span className="contract-spinner" />Đang tải nội dung hợp đồng…</div> : <>
      <ContractContent agreement={agreement} />
      {!readOnly && <>
      {agreement.canManagerRelease && <div className="contract-sign-form">
        <p>Kiểm tra nội dung hợp đồng trước khi mở quyền ký cho chủ xe.</p>
        <label>Ghi chú rà soát<input maxLength={1000} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} disabled={busy} /></label>
        <div className="contract-toolbar">
          <button className="contract-button contract-button--secondary" type="button" onClick={() => reviewManagement('revision')} disabled={busy || reviewNote.trim().length < 5}>Yêu cầu chỉnh sửa</button>
          <button className="contract-button contract-button--primary" type="button" onClick={() => reviewManagement('approve')} disabled={busy}>{busy ? 'Đang ghi nhận…' : 'Duyệt bản nháp và gửi chủ xe ký'}</button>
        </div>
      </div>}
      {agreement.canOperatorConfirm && <div className="contract-sign-form">
        <p>Chủ xe/người thuê đã xác nhận. Hãy kiểm tra hồ sơ và xác nhận đã tiếp nhận để chuyển Manager ký phía XeDi. Đây không phải phê duyệt nội dung hoặc chữ ký thay Manager.</p>
        <button className="contract-button contract-button--primary" type="button" onClick={confirmIntake} disabled={busy}>{busy ? 'Đang ghi nhận…' : 'Xác nhận đã tiếp nhận'}</button>
      </div>}
      {agreement.canSign ? <form onSubmit={sign} className="contract-sign-form">
        <label>Họ tên người ký<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></label>
        <label className="contract-accept"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy} /><span>Tôi đã đọc và đồng ý ký hợp đồng.</span></label>
        <button className="contract-button contract-button--primary" type="submit" disabled={busy || !accepted}>{busy ? 'Đang ghi nhận…' : view === 'staff' && agreement.type === 'management' ? 'Xác nhận hợp đồng phía XeDi' : 'Xác nhận ký hợp đồng'}</button>
      </form> :       <p className="contract-signing-note" role="status">      {view === 'staff' && agreement.partySigned && agreement.managerReviewStatus === 'approved' && !(agreement.platformSigned ?? Boolean(agreement.platformSignedAt))
          ? 'Chủ xe/người thuê đã ký sau bước rà soát. Hợp đồng đang chờ Manager ký phía XeDi.'
          : view === 'staff' && agreement.partySigned && agreement.operatorIntakeConfirmedAt && !(agreement.platformSigned ?? Boolean(agreement.platformSignedAt))
        ? 'Operator đã tiếp nhận hồ sơ. Hợp đồng đang chờ Manager ký phía XeDi.'
        : view === 'staff' && agreement.partySigned && !agreement.operatorIntakeConfirmedAt && !agreement.managerReviewStatus && roles.includes('MANAGER')
        ? 'Bên còn lại đã ký. Hợp đồng đang chờ Operator xác nhận tiếp nhận trước khi Manager có thể ký phía XeDi.'
        : !agreement.document
          ? 'Hồ sơ chưa có nội dung điện tử để ký. Manager cần lập nội dung trước khi các bên có thể xác nhận.'
        : agreement.status === 'pending_signatures'
          ? 'Bạn không cần ký phía này hoặc chữ ký của bạn đã được ghi nhận. Hợp đồng đang chờ bước tiếp theo.'
          : 'Hợp đồng hiện không cần chữ ký của bạn.'}</p>}
      </>}
    </>}
  </section></div>;
}

