import { useState } from 'react';
import { canAccessOwner, getCurrentUser } from '../../auth/session';
import useIdentityVerification from '../hooks/useIdentityVerification';
import './VerificationPage.css';

const labels = { unverified: 'Chưa gửi', pending: 'Đang xét duyệt', verified: 'Đã xác minh', revision_required: 'Cần bổ sung', rejected: 'Không đạt' };

export default function VerificationPage() {
  if (!canAccessOwner(getCurrentUser())) return <main className="verification-page"><p>Mục này dành cho chủ xe.</p><a href="#/renter/profile">Hồ sơ cá nhân</a></main>;
  return <OwnerVerificationForm />;
}

function OwnerVerificationForm() {
  const { data, loading, saving, error, submit, refresh } = useIdentityVerification();
  const [notice, setNotice] = useState('');
  const user = getCurrentUser();
  const locked = data?.identity.status === 'pending';
  const onSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await submit({ documentType: form.get('documentType'), identityNumber: form.get('identityNumber'), identityFile: form.get('identityFile'), licenseNumber: form.get('licenseNumber'), licenseClass: form.get('licenseClass'), expiresAt: form.get('expiresAt'), licenseFile: form.get('licenseFile') });
    if (saved) setNotice('Hồ sơ đã được gửi. XeDi sẽ xét duyệt trước khi bạn đăng ký xe cho thuê.');
  };
  if (loading) return <main className="verification-page"><p>Đang tải trạng thái xác minh…</p></main>;
  return <main className="verification-page"><a className="verification-back" href="#trang-chu">← Về trang chủ</a><section className="verification-card"><p className="verification-eyebrow">XÁC MINH DANH TÍNH</p><h1>eKYC và giấy phép lái xe</h1><p className="verification-intro">Xác minh một lần để đủ điều kiện tạo yêu cầu đặt xe. Tài liệu được lưu private và chỉ đội ngũ được phân quyền xem xét.</p>{user && <p className="verification-user">Hồ sơ của <strong>{user.full_name || user.email}</strong></p>}
    {error && <div className="verification-error" role="alert">{error}<button onClick={refresh}>Thử lại</button></div>}
    {notice && <div className="verification-notice">{notice}</div>}
    <div className="verification-status"><article><span>Giấy tờ định danh</span><strong className={`status-${data?.identity.status}`}>{labels[data?.identity.status] || data?.identity.status}</strong><small>{data?.identity.idMasked || 'CCCD hoặc hộ chiếu chưa được gửi'}</small>{data?.identity.reviewNote && <p>{data.identity.reviewNote}</p>}</article><article><span>Giấy phép lái xe</span><strong className={`status-${data?.driverLicense.status}`}>{labels[data?.driverLicense.status] || data?.driverLicense.status}</strong><small>{data?.driverLicense.licenseMasked || 'Bằng lái chưa được gửi'}</small>{data?.driverLicense.expiresAt && <small>Hết hạn: {new Date(data.driverLicense.expiresAt).toLocaleDateString('vi-VN')}</small>}{data?.driverLicense.reviewNote && <p>{data.driverLicense.reviewNote}</p>}</article></div>
    {!locked && <form className="verification-form" onSubmit={onSubmit}><h2>{data?.identity.status === 'revision_required' || data?.identity.status === 'rejected' ? 'Nộp lại hồ sơ' : 'Gửi hồ sơ xác minh'}</h2><div className="verification-grid"><label>Loại giấy tờ định danh<select name="documentType" defaultValue="national_id" required><option value="national_id">Căn cước công dân</option><option value="passport">Hộ chiếu</option></select></label><label>Số CCCD hoặc hộ chiếu<input name="identityNumber" minLength="6" maxLength="32" required /></label><label>Ảnh hoặc PDF giấy tờ<input name="identityFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label><label>Số giấy phép lái xe<input name="licenseNumber" minLength="6" maxLength="32" required /></label><label>Hạng bằng lái<input name="licenseClass" placeholder="Ví dụ: B2" maxLength="12" required /></label><label>Ngày hết hạn<input name="expiresAt" type="date" min={new Date().toISOString().slice(0, 10)} required /></label><label>Ảnh hoặc PDF bằng lái<input name="licenseFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label></div><p className="verification-hint">Chấp nhận JPG, PNG, WebP hoặc PDF, tối đa 4 MB mỗi tệp. Thông tin gửi đi sẽ chờ đội ngũ XeDi xét duyệt; không có kết quả tự động giả lập.</p><button disabled={saving}>{saving ? 'Đang gửi…' : 'Gửi hồ sơ eKYC'}</button></form>}
    {locked && <p className="verification-pending">Hồ sơ đang chờ xét duyệt, bạn chưa thể thay thế tài liệu trong lúc này.</p>}
  </section></main>;
}
