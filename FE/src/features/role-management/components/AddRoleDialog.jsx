import { useState } from 'react';
import AccessControlIcon from './AccessControlIcon';

export default function AddRoleDialog({ onClose, onSubmit }) {
  const [roleName, setRoleName] = useState('');

  function submit(event) {
    event.preventDefault();
    if (onSubmit(roleName)) onClose();
  }

  return (
    <div className="acl-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="acl-modal" role="dialog" aria-modal="true" aria-labelledby="add-role-title">
        <button type="button" className="modal-close" aria-label="Đóng" onClick={onClose}>×</button>
        <span className="modal-icon"><AccessControlIcon name="shield" size={20}/></span>
        <h2 id="add-role-title">Thêm vai trò mới</h2>
        <p>Tạo vai trò để phân quyền truy cập trong bản xem trước trên thiết bị này.</p>
        <form onSubmit={submit}>
          <label htmlFor="new-role-name">Tên vai trò</label>
          <input id="new-role-name" autoFocus value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="Nhập tên vai trò"/>
          <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Hủy</button><button type="submit" className="button button-primary" disabled={!roleName.trim()}><AccessControlIcon name="plus" size={15}/> Tạo vai trò</button></div>
        </form>
      </section>
    </div>
  );
}
