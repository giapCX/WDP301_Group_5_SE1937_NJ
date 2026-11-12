import { useState } from 'react';
import useVehicleRegistration from '../hooks/useVehicleRegistration';

const blankForm = { brand: '', model: '', licensePlate: '', vin: '', ownerContactAddress: '', publishVehiclePhotos: false, year: '', seats: '', vehicleType: 'Sedan', transmission: 'automatic', fuelType: 'gasoline', dailyPrice: '', mileageLimit: '200', extraMileageFee: '3000', description: '', conditionDeclaration: '', registration: null, inspectionCertificate: null, insurance: null, photos: [], acceptedTerms: false };

function Field({ label, children, required }) {
  return <label className="owner-field"><span>{label}{required && <b> *</b>}</span>{children}</label>;
}
function RegistrationDialog({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState('');
  const { submit: submitRegistration, saving, error: submitError } = useVehicleRegistration();
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const advance = (event) => {
    event.preventDefault(); setError('');
    if (step === 1 && (!form.brand || !form.model || !form.licensePlate || !form.year || !form.seats || !form.dailyPrice || !form.description.trim() || !form.conditionDeclaration.trim())) return setError('Vui lòng điền đầy đủ thông tin xe trước khi tiếp tục.');
    if (step === 2 && (!form.registration || !form.inspectionCertificate || !form.insurance || form.photos.length < 2)) return setError('Cần đủ 3 giấy tờ và tối thiểu 2 ảnh xe để gửi hồ sơ.');
    setStep((current) => Math.min(3, current + 1));
  };
  const submit = async () => {
    setError('');
    const result = await submitRegistration(form);
    if (result) onCreated(result);
  };
  const chooseFile = (key, file) => update(key, file || null);
  return <div className="owner-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="owner-modal" role="dialog" aria-modal="true" aria-labelledby="register-title">
      <header className="owner-modal-head"><div><span className="owner-eyebrow">ĐƯA XE LÊN XEDi</span><h2 id="register-title">Đăng ký xe cho thuê</h2><p>Gửi thông tin và giấy tờ xe. Hợp đồng sẽ ký riêng sau khi xe được duyệt.</p></div><button className="owner-close" onClick={onClose} aria-label="Đóng">×</button></header>
      <div className="owner-steps"><span className={step >= 1 ? 'active' : ''}>1 <b>Thông tin xe</b></span><i className={step >= 2 ? 'done' : ''}/><span className={step >= 2 ? 'active' : ''}>2 <b>Hồ sơ xe</b></span><i className={step >= 3 ? 'done' : ''}/><span className={step >= 3 ? 'active' : ''}>3 <b>Xác nhận hồ sơ</b></span></div>
      {(error || submitError) && <div className="owner-error" role="alert">{submitError || error}</div>}
      {step === 1 && <form onSubmit={advance} className="owner-form">
        <div className="owner-form-grid"><Field label="Hãng xe" required><input value={form.brand} onChange={(e) => update('brand', e.target.value)} placeholder="Ví dụ: Toyota" maxLength="60" required/></Field><Field label="Dòng xe" required><input value={form.model} onChange={(e) => update('model', e.target.value)} placeholder="Ví dụ: Vios G" maxLength="60" required/></Field><Field label="Biển số xe" required><input value={form.licensePlate} onChange={(e) => update('licensePlate', e.target.value.toUpperCase())} placeholder="30A-123.45" maxLength="16" required/></Field><Field label="Năm sản xuất" required><input type="number" min="1990" max={new Date().getFullYear()+1} value={form.year} onChange={(e) => update('year', e.target.value)} required/></Field><Field label="Số chỗ" required><select value={form.seats} onChange={(e) => update('seats', e.target.value)} required><option value="">Chọn số chỗ</option>{[2,4,5,7,9,16,29,45].map((number) => <option key={number} value={number}>{number} chỗ</option>)}</select></Field><Field label="Kiểu xe"><select value={form.vehicleType} onChange={(e) => update('vehicleType', e.target.value)}>{['Sedan','SUV','Hatchback','MPV','Bán tải','Khác'].map((type) => <option key={type}>{type}</option>)}</select></Field><Field label="Hộp số"><select value={form.transmission} onChange={(e) => update('transmission', e.target.value)}><option value="automatic">Tự động</option><option value="manual">Số sàn</option></select></Field><Field label="Nhiên liệu"><select value={form.fuelType} onChange={(e) => update('fuelType', e.target.value)}><option value="gasoline">Xăng</option><option value="diesel">Dầu diesel</option><option value="electric">Điện</option><option value="hybrid">Hybrid</option></select></Field><Field label="Giá thuê mỗi ngày (₫)" required><input type="number" min="100000" step="50000" value={form.dailyPrice} onChange={(e) => update('dailyPrice', e.target.value)} required/></Field><Field label="Km bao gồm mỗi ngày"><input type="number" min="50" max="2000" value={form.mileageLimit} onChange={(e) => update('mileageLimit', e.target.value)}/></Field><Field label="Phí vượt km (₫/km)"><input type="number" min="0" value={form.extraMileageFee} onChange={(e) => update('extraMileageFee', e.target.value)}/></Field></div>
        <Field label="Địa chỉ chủ xe ghi trên hợp đồng"><input value={form.ownerContactAddress} maxLength={250} onChange={(e) => update('ownerContactAddress', e.target.value)} /></Field>
        <Field label="Số khung (VIN)"><input value={form.vin} maxLength={40} onChange={(e) => update('vin', e.target.value)} /></Field>
        <Field label="Hiện trạng xe và lỗi đã biết" required><textarea rows="3" value={form.conditionDeclaration} onChange={(e) => update('conditionDeclaration', e.target.value)} placeholder="Vị trí và mức độ từng lỗi, hoặc ghi chưa phát hiện lỗi." maxLength="1500" required /></Field>
        <Field label="Mô tả xe" required><textarea rows="3" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Tình trạng xe, tiện nghi và lưu ý cho khách thuê…" maxLength="2000" required/></Field>
        <footer className="owner-modal-actions"><button type="button" className="owner-secondary" onClick={onClose}>Hủy</button><button className="owner-primary">Tiếp tục <span>→</span></button></footer>
      </form>}
      {step === 2 && <div className="owner-form owner-doc-form"><p className="owner-form-note">Tệp PDF, JPG, PNG hoặc WEBP, tối đa 4 MB mỗi tệp. Tải lên tối thiểu 2 và tối đa 5 ảnh xe.</p><div className="owner-form-grid">{[['registration','Giấy đăng ký xe'],['inspectionCertificate','Giấy chứng nhận đăng kiểm'],['insurance','Giấy chứng nhận bảo hiểm']].map(([key,label]) => <Field label={label} key={key} required><input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(e) => chooseFile(key, e.target.files?.[0])} required/><small>{form[key]?.name || 'Chưa chọn tệp'}</small></Field>)}</div><Field label="Ảnh ngoại thất và nội thất (tối thiểu 2 ảnh)" required><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => update('photos', Array.from(e.target.files || []).slice(0,5))} required/><small>{form.photos.length ? `${form.photos.length} ảnh đã chọn` : 'Có thể chọn tối đa 5 ảnh'}</small></Field><footer className="owner-modal-actions"><button className="owner-secondary" onClick={() => setStep(1)}>← Quay lại</button><button className="owner-primary" onClick={advance}>Tiếp tục <span>→</span></button></footer></div>}
      {step === 3 && <div className="owner-form owner-agreement"><div className="agreement-summary"><span className="agreement-icon">✦</span><div><strong>Thỏa thuận quản lý xe XeDi</strong><p>{form.brand} {form.model} · {form.licensePlate}</p></div></div><div className="agreement-terms"><h3>Điều khoản chính</h3><ul><li>XeDi hỗ trợ quản lý niêm yết, đặt xe và bàn giao xe theo quy trình.</li><li>Phí nền tảng mặc định là <strong>10% doanh thu thuê xe</strong>, không tính tiền đặt cọc.</li><li>Hồ sơ xe được kiểm tra trực tuyến và kiểm định tình trạng tại gara trước khi niêm yết.</li><li>Chủ xe cam kết giấy tờ tải lên hợp lệ và có quyền cho thuê phương tiện.</li></ul></div><label className="owner-accept"><input type="checkbox" checked={form.publishVehiclePhotos} onChange={(e) => update('publishVehiclePhotos', e.target.checked)} /><span>Cho phép dùng ảnh ngoại thất và nội thất trên tin xe sau khi Operation xuất bản.</span></label><label className="owner-accept"><input type="checkbox" checked={form.acceptedTerms} onChange={(e) => update('acceptedTerms', e.target.checked)}/><span>Tôi xác nhận hồ sơ xe chính xác và đồng ý quy trình đăng ký. Đây chưa phải thao tác ký hợp đồng.</span></label><footer className="owner-modal-actions"><button className="owner-secondary" onClick={() => setStep(2)}>← Quay lại</button><button className="owner-primary" disabled={!form.acceptedTerms || saving} onClick={submit}>{saving ? 'Đang gửi hồ sơ…' : 'Gửi hồ sơ xe'} <span>→</span></button></footer></div>}
    </section>
  </div>;
}


export default RegistrationDialog;
