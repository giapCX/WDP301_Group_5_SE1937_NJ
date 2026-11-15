import { saveErrorMessage } from '../../../services/saveErrorMessage';
import { useState } from 'react';
import Modal from '../../../components/ui/Modal';

export default function ManagerActionForm({ title, context, fields, onSubmit, onClose }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const values = {};
    for (const { name, label, type, minLength = 0, required = true } of fields) {
      const raw = String(form.get(name) ?? '');
      const value = type === 'password' ? raw : raw.trim();
      if (value.length < Math.max(required ? 1 : 0, minLength)) {
        setError(minLength ? `${label} cần ít nhất ${minLength} ký tự.` : `Hãy nhập ${label.toLowerCase()}.`);
        return;
      }
      if (type === 'number' && !Number.isSafeInteger(Number(value))) {
        setError(`${label} cần là số nguyên hợp lệ.`);
        return;
      }
      values[name] = type === 'number' ? Number(value) : value;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit(values);
      onClose();
    } catch (reason) {
      setError(saveErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return <Modal title={title} onClose={() => { if (!saving) onClose(); }}>
    <form className="manager-action-form" onSubmit={submit}>
      {context && <p>{context}</p>}
      {fields.map(({ name, label, type = 'text', value = '', options, required = true, minLength, maxLength, min, step }) => {
        const props = { name, defaultValue: value, required, disabled: saving, minLength, maxLength };
        return <label key={name}>{label}
          {options ? <select {...props}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>
            : type === 'textarea' ? <textarea {...props} rows={name === 'config' ? 8 : 3} />
              : <input {...props} type={type} min={min} step={step} />}
        </label>;
      })}
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="manager-primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
    </form>
  </Modal>;
}
