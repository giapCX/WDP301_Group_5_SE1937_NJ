import { useState } from 'react';
import useOwnerActions from '../hooks/useOwnerActions';
import { getCurrentUser } from '../../auth/session';
import { ContractContent } from '../../contracts/ContractsPage';

const readEvidence = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, contentType: file.type, data: reader.result }); reader.onerror = () => reject(new Error(`Không đọc được tệp ${file.name}.`)); reader.readAsDataURL(file); });

export default function OwnerActions({ data, agreement, agreementError, agreementLoading, onDone, onCloseAgreement }) {
  const actions = useOwnerActions();
  const [mode, setMode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [incidentType, setIncidentType] = useState('vehicle_damage');
  const [signatureName, setSignatureName] = useState(getCurrentUser()?.full_name || '');
  const usableVehicles = data.vehicles.filter((item) => ['approved', 'revision_required'].includes(item.approvalStatus));
  const open = (next) => { setError(''); if (next === 'incident') setIncidentType('vehicle_damage'); setMode(next); };
  const close = () => { setMode(''); onCloseAgreement(); };
  const submit = async (event, action, success) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await action(new FormData(event.currentTarget)); close(); onDone(success(result.data)); }
    catch (reason) { setError(reason.message || 'Không thể gửi yêu cầu.'); }
    finally { setBusy(false); }
  };
  const downloadAgreement = () => {
    const text = `${agreement.number}\nTrạng thái: ${agreement.status}\n${(agreement.document?.facts || []).map((fact) => `${fact.label}: ${fact.value}`).join('\n')}\n\n${agreement.terms.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\nChủ xe: ${agreement.partyName || ''} — ${agreement.partySignedAt || 'Chưa ký'}\nĐại diện XeDi: ${agreement.platformName || ''} — ${agreement.platformSignedAt || 'Chưa ký'}\nPhiên bản: ${agreement.document?.version || 'Hồ sơ cũ'}`;
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); link.download = `${agreement.number}.txt`; link.click(); URL.revokeObjectURL(link.href);
  };
  const signAgreement = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await actions.signAgreement(agreement.id, { signatureName, acceptedTerms: true, documentHash: agreement.document?.hash });
      close(); onDone(result.data.status === 'active' ? `Hợp đồng ${result.data.number} đã có hiệu lực.` : `Đã ghi nhận chữ ký hợp đồng ${result.data.number}; đang chờ XeDi ký xác nhận.`);
    } catch (reason) { setError(reason.message || 'Không ký được hợp đồng.'); }
    finally { setBusy(false); }
  };
  return <>
    <p><a href="/#/contracts">Xem nội dung và ký hợp đồng quản lý xe →</a></p>
    <div className="owner-action-bar"><div><strong>Yêu cầu dịch vụ</strong><span>Quản lý rút xe, chi trả và báo cáo sự cố</span></div><div className="owner-action-buttons"><button className="owner-secondary" onClick={() => open('withdrawal')}>Yêu cầu rút xe</button><button className="owner-secondary" onClick={() => open('incident')}>＋ Báo cáo sự cố</button><button className="owner-primary" onClick={() => open('payout')}>Yêu cầu chi trả</button></div></div>
    {error && !mode && <div className="owner-error" role="alert">{error}</div>}
    {(mode || agreement || agreementError || agreementLoading) && <div className="owner-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="owner-modal" role="dialog" aria-modal="true">
      <button className="owner-modal-close" onClick={close} aria-label="Đóng">×</button>
      {agreementLoading && <p className="owner-loading">Đang tải nội dung hợp đồng…</p>}
      {agreementError && <p className="owner-form-error">{agreementError}</p>}
      {agreement && <><ContractContent agreement={agreement} />{agreement.canOwnerSign && <form className="owner-sign-form" onSubmit={signAgreement}><label>Họ tên người ký<input value={signatureName} onChange={(event) => setSignatureName(event.target.value)} required maxLength="120" /></label><label className="owner-sign-accept"><input type="checkbox" required />Tôi xác nhận đã đọc, hiểu và đồng ý ký hợp đồng điện tử này.</label>{error && <p className="owner-form-error">{error}</p>}<button className="owner-primary" disabled={busy}>{busy ? 'Đang ghi nhận chữ ký…' : 'Xác nhận và ký hợp đồng'}</button></form>}{!agreement.document?.articles?.length && <button className="owner-secondary" onClick={downloadAgreement}>Tải bản hợp đồng</button>}</>}
      {mode === 'payout' && <form onSubmit={(event) => submit(event, () => actions.requestPayout({}), (result) => `Đã gửi yêu cầu chi trả ${new Intl.NumberFormat('vi-VN').format(result.amount)} ₫.`)}><span className="owner-eyebrow">ĐỐI SOÁT THU NHẬP</span><h2>Yêu cầu chi trả</h2><p>Số dư chỉ tính các kỳ đối soát sẵn sàng thanh toán. Mức tối thiểu 100.000 ₫.</p>{data.payoutAccount ? <div className="owner-payout-account"><strong>Tài khoản nhận tiền</strong><span>{data.payoutAccount.bankName} · {data.payoutAccount.accountMasked}</span><small>Khoản chi trả sẽ được gửi vào tài khoản ngân hàng đã liên kết.</small></div> : <p className="owner-form-error">Bạn chưa có tài khoản ngân hàng đã liên kết.</p>}{error && <p className="owner-form-error">{error}</p>}<button className="owner-primary" disabled={busy || !data.payoutAccount}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu chi trả'}</button></form>}
      {mode === 'withdrawal' && <form onSubmit={(event) => submit(event, (form) => actions.requestVehicleWithdrawal({ vehicleId: form.get('vehicleId'), reason: form.get('reason'), requestedReturnAt: form.get('requestedReturnAt') }), () => 'Yêu cầu rút xe đã được gửi. XeDi sẽ liên hệ để chốt bàn giao và đối soát.') }><span className="owner-eyebrow">QUẢN LÝ ĐỘI XE</span><h2>Yêu cầu rút xe</h2><p>Yêu cầu sẽ được vận hành xem xét; xe còn chuyến xác nhận/đang diễn ra chưa thể rút.</p><label>Phương tiện<select name="vehicleId" required defaultValue="">{usableVehicles.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model} · {item.licensePlate}</option>)}</select></label><label>Ngày mong muốn nhận lại xe<input type="date" name="requestedReturnAt" min={new Date().toISOString().slice(0, 10)} /></label><label>Lý do<textarea name="reason" required minLength="5" maxLength="1000" rows="4" /></label>{error && <p className="owner-form-error">{error}</p>}<button className="owner-primary" disabled={busy || !usableVehicles.length}>{busy ? 'Đang gửi…' : usableVehicles.length ? 'Gửi yêu cầu rút xe' : 'Không có xe đủ điều kiện'}</button></form>}
      {mode === 'incident' && <form onSubmit={(event) => submit(event, async (form) => { const files = form.getAll('evidence').filter((file) => file.size > 0); const evidence = await Promise.all(files.map(readEvidence)); return actions.reportIncident({ vehicleId: form.get('vehicleId'), caseType: form.get('caseType'), bookingId: form.get('bookingId') || undefined, description: form.get('description'), compensationAmount: form.get('compensationAmount') || undefined, noticeNumber: form.get('noticeNumber') || undefined, fineAmountClaimed: form.get('fineAmountClaimed') || undefined, evidence }); }, (result) => `Đã gửi báo cáo ${result.caseNumber} đến đội ngũ vận hành.`)}><span className="owner-eyebrow">HỖ TRỢ VẬN HÀNH</span><h2>Báo cáo sự cố</h2><p>Cung cấp thông tin sự cố để đội ngũ XeDi kiểm tra và cập nhật phương án xử lý.</p><label>Phương tiện<select name="vehicleId" required defaultValue="">{data.vehicles.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model} · {item.licensePlate}</option>)}</select></label><label>Loại sự cố<select name="caseType" value={incidentType} onChange={(event) => setIncidentType(event.target.value)}><option value="vehicle_damage">Hư hỏng phương tiện</option><option value="traffic_violation">Vi phạm giao thông</option><option value="theft">Mất cắp</option><option value="other">Khác</option></select></label>{incidentType === 'traffic_violation' && <><label>Mã biên bản (nếu có)<input name="noticeNumber" maxLength="80" /></label><label>Mức phạt giao thông đề xuất (₫)<input name="fineAmountClaimed" type="number" min="1" max="1000000000" /></label></>}<label>Mã chuyến thuê (nếu có)<input name="bookingId" placeholder="ID chuyến thuê" /></label><label>Nội dung<textarea name="description" required minLength="10" maxLength="3000" rows="4" /></label><label>Mức bồi thường đề xuất (₫, nếu có)<input name="compensationAmount" type="number" min="1" max="1000000000" /></label><label>Ảnh hoặc tài liệu minh chứng (tối đa 3 tệp, 4 MB/tệp)<input name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple /></label>{error && <p className="owner-form-error">{error}</p>}<button className="owner-primary" disabled={busy || !data.vehicles.length}>{busy ? 'Đang gửi…' : 'Gửi báo cáo sự cố'}</button></form>}
    </section></div>}
  </>;
}
