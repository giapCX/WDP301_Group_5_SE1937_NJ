import { useState } from 'react';
import AccessControlIcon from './AccessControlIcon';

export default function CreateAccountDialog({ roles, onClose, onSubmit }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role_id: '', password: '' });
  const [saving, setSaving] = useState(false);
  const setField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try { if (await onSubmit({ ...form, role_id: Number(form.role_id) })) onClose(); }
    finally { setSaving(false); }
  }

  return <div className="acl-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="acl-modal" role="dialog" aria-modal="true" aria-labelledby="create-account-title">
      <button type="button" className="modal-close" aria-label="Đóng" onClick={onClose}>×</button>
      <span className="modal-icon"><AccessControlIcon name="users" size={20}/></span>
      <h2 id="create-account-title">Tạo tài khoản nhân viên</h2>
      <p>Tài khoản được tạo trực tiếp trên hệ thống.</p>
      <form onSubmit={submit} className="acl-account-form">
        <label>Họ và tên<input name="full_name" value={form.full_name} onChange={setField} maxLength={120} required/></label>
        <label>Email<input name="email" type="email" value={form.email} onChange={setField} maxLength={150} required/></label>
        <label>Số điện thoại<input name="phone" type="tel" value={form.phone} onChange={setField} maxLength={20}/></label>
        <label>Vai trò<select name="role_id" value={form.role_id} onChange={setField} required><option value="">Chọn vai trò</option>{roles.filter((role) => role.role_name !== 'renter').map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
        <label>Mật khẩu khởi tạo<input name="password" type="password" value={form.password} onChange={setField} minLength={12} maxLength={128} required/></label>
        <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Hủy</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Đang tạo…' : 'Tạo tài khoản'}</button></div>
      </form>
    </section>
  </div>;
}
