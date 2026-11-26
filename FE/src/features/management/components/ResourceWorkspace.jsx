import { useCallback, useEffect, useState } from 'react';
import { createManagementResource, listDriverCandidates, listManagementResource, updateManagementResource } from '../api/managementApi.js';
import { RESOURCE_APPROVAL_STATUS, RESOURCE_CONFIG } from '../resourceManagementConfig.js';
import '../styles/management.css';

const ID_FIELD = { users: 'user_id', vehicles: 'vehicle_id', driver_profiles: 'driver_id', pricing_rules: 'rule_id', service_policies: 'policy_id', reports: 'name' };
const getValue = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);
const setValue = (row, path, value) => {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((current, key) => (current[key] ||= {}), row);
  target[last] = value;
};
const removeEmptyObjects = (value) => {
  Object.entries(value).forEach(([key, child]) => {
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      removeEmptyObjects(child);
      if (!Object.keys(child).length) delete value[key];
    }
  });
  return value;
};
const pretty = (value) => value instanceof Date ? value.toLocaleDateString('vi-VN') : value == null || value === '' ? '—' : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Intl.DateTimeFormat('vi-VN').format(new Date(value)) : String(value);

function Editor({ config, roles, candidates, item, onClose, onSave }) {
  const fields = config.fixedPricing
    ? config.fields.filter(([key]) => item?.service_type === 'tour'
      ? ['day_rate', 'included_km_per_day', 'extra_km_rate', 'driver_night_rate'].includes(key)
      : ['km_rate', 'dispatch_percent'].includes(key))
    : config.fields;
  const [initialValues] = useState(() => {
    const initial = {};
    fields.forEach(([key, , type]) => {
      const value = getValue(item, key);
      initial[key] = type === 'date' && value ? String(value).slice(0, 10) : value ?? '';
    });
    return initial;
  });
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const payload = {};
    fields.forEach(([key]) => { if (values[key] !== '') setValue(payload, key, values[key]); });
    if (item) {
      fields.forEach(([key]) => {
        if (String(values[key] ?? '') === String(initialValues[key] ?? '')) {
          const parts = key.split('.');
          let target = payload;
          while (parts.length > 1) target = target?.[parts.shift()];
          if (target) delete target[parts[0]];
        }
      });
    }
    fields.forEach(([key, , type]) => {
      if (type === 'number' && values[key] !== undefined && values[key] !== '') setValue(payload, key, Number(values[key]));
      if (type === 'user' && values[key] !== undefined && values[key] !== '') setValue(payload, key, Number(values[key]));
    });
    removeEmptyObjects(payload);
    setSaving(true);
    try { await onSave(payload); } finally { setSaving(false); }
  }
  return <div className="acl-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="acl-modal resource-editor" role="dialog" aria-modal="true" aria-labelledby="resource-editor-title">
      <button type="button" className="modal-close" aria-label="Đóng" onClick={onClose}>×</button>
      <h2 id="resource-editor-title">{item ? 'Cập nhật' : 'Thêm'} · {config.title}</h2>
      <form onSubmit={submit} className="acl-account-form">
        {fields.filter(([key]) => (item || !['status', 'availability_status'].includes(key)) && (!item || !['password', 'user_id'].includes(key))).map(([key, label, type, required, options]) => <label key={key}>{label}
          {type === 'role' ? <select required={required} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}><option value="">Chọn vai trò</option>{roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.role_name}</option>)}</select>
            : type === 'user' ? <select required={required} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}><option value="">Chọn tài khoản tài xế</option>{candidates.map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{candidate.full_name} · {candidate.email}</option>)}</select>
            : type === 'select' ? <select value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}>{!options.some(([value]) => value === values[key]) && <option value={values[key]}>Trạng thái hiện tại ({values[key]})</option>}{options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select>
            : type === 'textarea' ? <textarea rows={3} value={values[key]} required={required} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}/>
              : <input type={type} value={values[key]} required={required} min={type === 'number' ? 0 : undefined} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}/>}</label>)}
        <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Hủy</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu dữ liệu'}</button></div>
      </form>
    </section>
  </div>;
}

export default function ResourceWorkspace({ workspace, onNotice, actor = 'admin', onlyPending = false }) {
  const config = RESOURCE_CONFIG[workspace];
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const visibleItems = items.filter((item) => !onlyPending || item.approval_status === 'pending' || item.approval_status === 'pending_review' || (!item.approval_status && item.status === 'pending'));
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, availableRoles, availableCandidates] = await Promise.all([
        listManagementResource(config.resource, undefined, actor), workspace === 'users' ? listManagementResource('roles', undefined, actor) : Promise.resolve([]),
        workspace === 'driver_profiles' ? listDriverCandidates(actor) : Promise.resolve([]),
      ]);
      setItems(rows);
      setRoles(actor === 'admin' && workspace === 'users'
        ? availableRoles.filter((role) => role.role_name !== 'renter')
        : availableRoles);
      setCandidates(availableCandidates);
      setError('');
    } catch (failure) { setError(failure.response?.data?.message || 'Không thể tải dữ liệu.'); }
    finally { setLoading(false); }
  }, [config.resource, workspace, actor]);
  useEffect(() => { refresh(); }, [refresh]);

  async function save(payload) {
    try {
      if (editor.item) await updateManagementResource(config.resource, editor.item[ID_FIELD[config.resource]], payload, actor);
      else await createManagementResource(config.resource, payload, actor);
      setEditor(null);
      await refresh();
      onNotice('Đã lưu dữ liệu lên hệ thống.');
    } catch (failure) { onNotice(failure.response?.data?.message || 'Không thể lưu dữ liệu.'); }
  }

  async function changeStatus(item, status) {
    try {
      const field = config.reviewPermission ? 'approval_status' : 'status';
      await updateManagementResource(config.resource, item[ID_FIELD[config.resource]], { [field]: status }, actor);
      await refresh();
      onNotice('Đã cập nhật trạng thái.');
    } catch (failure) { onNotice(failure.response?.data?.message || 'Không thể cập nhật trạng thái.'); }
  }

  async function review(item, decision) {
    try {
      await updateManagementResource(config.resource, item[ID_FIELD[config.resource]], { approval_status: decision }, actor);
      await refresh();
      onNotice('Đã cập nhật kết quả xét duyệt.');
    } catch (failure) { onNotice(failure.response?.data?.message || 'Không thể xét duyệt hồ sơ.'); }
  }

  return <section className="acl-panel resource-workspace">
    <div className="panel-heading"><div><h2>{onlyPending ? `Chờ duyệt · ${config.title}` : config.title}</h2><p>{config.description}</p></div>{!config.readOnly && config.canCreate !== false && !onlyPending && <button type="button" className="button button-primary" onClick={() => setEditor({ item: null })}>+ Thêm mới</button>}</div>
    {error && <div className="acl-feedback" role="alert">{error}<button type="button" onClick={refresh}>Thử lại</button></div>}
    {loading ? <p role="status" className="resource-loading">Đang tải dữ liệu…</p> : <div className="people-table-wrap"><table className="people-table"><thead><tr>{config.columns.map(([key, label]) => <th key={key}>{label.toLocaleUpperCase('vi')}</th>)}<th>THAO TÁC</th></tr></thead>
      <tbody>{visibleItems.map((item) => <tr key={item[ID_FIELD[config.resource]] || String(item._id)}>{config.columns.map(([key]) => <td key={key}>{pretty(getValue(item, key))}</td>)}<td className="resource-actions">
        {config.resource === 'users' && <button type="button" className="text-link" onClick={() => changeStatus(item, item.status === 'active' ? 'locked' : 'active')}>{item.status === 'active' ? 'Khóa' : 'Mở khóa'}</button>}
        {['pricing_rules', 'service_policies'].includes(config.resource) && !config.fixedPricing ? <button type="button" className="text-link" onClick={() => changeStatus(item, item.status === 'active' ? 'inactive' : 'active')}>{item.status === 'active' ? 'Ngừng dùng' : 'Kích hoạt'}</button> : null}
        {!config.readOnly && config.reviewPermission && item.approval_status === RESOURCE_APPROVAL_STATUS.PENDING && <><button type="button" className="text-link" onClick={() => review(item, RESOURCE_APPROVAL_STATUS.APPROVED)}>Duyệt</button><button type="button" className="text-link" onClick={() => review(item, RESOURCE_APPROVAL_STATUS.REJECTED)}>Từ chối</button></>}
        {!config.readOnly && <button type="button" className="text-link" onClick={() => setEditor({ item })}>Sửa</button>}
      </td></tr>)}{!visibleItems.length && <tr><td colSpan={config.columns.length + 1} className="resource-empty">{onlyPending ? 'Không có hồ sơ đang chờ phê duyệt.' : 'Chưa có dữ liệu trong hệ thống.'}</td></tr>}</tbody>
    </table></div>}
    {editor && <Editor config={config} roles={roles} candidates={candidates} item={editor.item} onClose={() => setEditor(null)} onSave={save}/>}
  </section>;
}
