import { useState } from 'react';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';
import './AccountsWorkspace.css';

const emptyForm = () => ({ name: '', email: '', phone: '', password: '', roles: [], status: 'active' });

export default function AccountsWorkspace({ onNotice }) {
  const accountsRequest = useManagerCollection('accounts');
  const rolesRequest = useManagerCollection('roles');
  const { createAccount, updateAccount } = useManagerActions();
  const [formError, setFormError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const accounts = accountsRequest.data;
  const roles = rolesRequest.data;
  const loading = accountsRequest.loading || rolesRequest.loading;
  const loadError = actionError || accountsRequest.error || rolesRequest.error;

  const assignableRoles = roles.filter((role) => role.code !== 'ADMIN');
  const refresh = () => { setActionError(''); accountsRequest.refresh(); rolesRequest.refresh(); };
  const changeForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const selectedRoles = form.roles.filter((code) => assignableRoles.some((role) => role.code === code));

    if (name.length < 2 || name.length > 120) return setFormError('Họ tên phải có từ 2 đến 120 ký tự.');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setFormError('Hãy nhập địa chỉ email hợp lệ (tối đa 254 ký tự).');
    if (phone.length > 40) return setFormError('Số điện thoại không được dài quá 40 ký tự.');
    if (form.password.length < 8 || form.password.length > 128) return setFormError('Mật khẩu phải có từ 8 đến 128 ký tự.');
    if (!selectedRoles.length) return setFormError('Hãy chọn ít nhất một vai trò hợp lệ.');
    if (!['active', 'suspended'].includes(form.status)) return setFormError('Trạng thái tài khoản không hợp lệ.');

    setSaving(true);
    try {
      await createAccount({ ...form, name, email, phone, roles: selectedRoles });
      setForm(emptyForm());
      setFormOpen(false);
      onNotice('Đã tạo tài khoản.');
      refresh();
    } catch (error) {
      setFormError(error.message || 'Không thể tạo tài khoản.');
    } finally {
      setSaving(false);
    }
  };

  const saveAccountRoles = (account) => {
    const input = window.prompt('Danh sách mã vai trò:', account.roles.join(', '));
    if (input === null) return;
    const selectedRoles = [...new Set(input.split(',').map((role) => role.trim().toUpperCase()).filter(Boolean))];
    if (!account.roles.includes('ADMIN') && selectedRoles.includes('ADMIN')) {
      onNotice('Không thể cấp quyền Admin qua chỉnh sửa tài khoản.');
      return;
    }
    if (!selectedRoles.length) {
      onNotice('Tài khoản phải có ít nhất một vai trò.');
      return;
    }
    updateAccount(account.id, { roles: selectedRoles })
      .then(() => { onNotice('Đã cập nhật vai trò tài khoản.'); refresh(); })
      .catch((error) => setActionError(error.message || 'Không thể cập nhật vai trò tài khoản.'));
  };

  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải dữ liệu…</p></section>;
  if (loadError) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{loadError}<button onClick={refresh}>Thử lại</button></div></section>;

  return <section className="manager-panel workspace-panel">
    <div className="workspace-header"><div><h2>Quản lý tài khoản</h2><p>Tạo tài khoản, gán vai trò và khóa hoặc mở khóa truy cập.</p></div><span className="workspace-count">{accounts.length} tài khoản</span></div>
    <button className="action-approve" onClick={() => { setFormError(''); setFormOpen(true); }}>Tạo tài khoản</button>

    {formOpen && <div className="account-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
      <form className="account-modal" role="dialog" aria-modal="true" onSubmit={submit} aria-labelledby="create-account-title">
        <div className="account-modal-heading"><div><h3 id="create-account-title">Tạo tài khoản mới</h3><p>Nhập thông tin đăng nhập và chọn vai trò được cấp.</p></div><button type="button" className="account-modal-close" aria-label="Đóng" onClick={() => setFormOpen(false)}>×</button></div>
        <label>Họ và tên<input autoFocus required minLength={2} maxLength={120} value={form.name} onChange={(event) => changeForm('name', event.target.value)} /></label>
        <div className="account-form-row"><label>Email đăng nhập<input required type="email" maxLength={254} value={form.email} onChange={(event) => changeForm('email', event.target.value)} /></label><label>Số điện thoại <span>(không bắt buộc)</span><input type="tel" maxLength={40} value={form.phone} onChange={(event) => changeForm('phone', event.target.value)} /></label></div>
        <label>Mật khẩu ban đầu<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={(event) => changeForm('password', event.target.value)} /><small>Tối thiểu 8 ký tự.</small></label>
        <fieldset className="account-role-picker"><legend>Vai trò <span>· chọn ít nhất một</span></legend>{assignableRoles.map((role) => <label key={role.id}><input type="checkbox" checked={form.roles.includes(role.code)} onChange={(event) => changeForm('roles', event.target.checked ? [...form.roles, role.code] : form.roles.filter((code) => code !== role.code))} /><span><strong>{role.name}</strong><small>{role.code}</small></span></label>)}<p>Không thể cấp quyền Admin khi tạo tài khoản.</p></fieldset>
        <label>Trạng thái<select value={form.status} onChange={(event) => changeForm('status', event.target.value)}><option value="active">Đang hoạt động</option><option value="suspended">Tạm khóa</option></select></label>
        {formError && <p className="account-form-error" role="alert">{formError}</p>}
        <div className="account-modal-actions"><button type="button" className="account-cancel" onClick={() => setFormOpen(false)}>Hủy</button><button className="action-approve" type="submit" disabled={saving || !assignableRoles.length}>{saving ? 'Đang tạo…' : 'Tạo tài khoản'}</button></div>
      </form>
    </div>}

    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>HỌ VÀ TÊN</th><th>EMAIL</th><th>ĐIỆN THOẠI</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.name}</strong></td><td>{account.email || '—'}</td><td>{account.phone || '—'}</td><td>{(account.roleNames || account.roles).join(', ')}</td><td><select className="workspace-select" value={account.status} onChange={(event) => updateAccount(account.id, { status: event.target.value }).then(() => { onNotice('Đã cập nhật trạng thái tài khoản.'); refresh(); }).catch((error) => setActionError(error.message || 'Không thể cập nhật trạng thái tài khoản.'))}><option value="active">Đang hoạt động</option><option value="suspended">Tạm khóa</option></select></td><td><button className="action-review" onClick={() => saveAccountRoles(account)}>Sửa vai trò</button></td></tr>)}</tbody></table>{!accounts.length && <p className="manager-empty">Không có tài khoản.</p>}</div>
  </section>;
}
