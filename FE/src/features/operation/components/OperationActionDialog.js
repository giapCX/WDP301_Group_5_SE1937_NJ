export default function OperationActionDialog({ dialog, busy, onClose, onSubmit }) {
  if (!dialog) return null;
  return (
    <div className="operation-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <form className="operation-detail operation-action-dialog" role="dialog" aria-modal="true" aria-labelledby="operation-action-title" onSubmit={onSubmit}>
        <button type="button" className="operation-detail-close" onClick={onClose} aria-label="Đóng" disabled={busy}>×</button>
        <p className="operation-eyebrow">THAO TÁC VẬN HÀNH</p>
        <h2 id="operation-action-title">{dialog.title}</h2>
        {dialog.description && <p className="operation-action-description">{dialog.description}</p>}
        <div className="operation-action-fields">
          {dialog.fields.map((item) => (
            <label key={item.name}>
              {item.label}
              {item.type === 'textarea' ? (
                <textarea name={item.name} defaultValue={item.value} required={item.required} maxLength={item.maxLength} />
              ) : item.type === 'select' ? (
                <select name={item.name} defaultValue={item.value} required={item.required}>
                  <option value="" disabled>Chọn một mục</option>
                  {item.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input name={item.name} type={item.type} defaultValue={item.value} required={item.required} maxLength={item.maxLength} min={item.min} step={item.step} />
              )}
            </label>
          ))}
        </div>
        <footer>
          <button type="button" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="operation-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : dialog.confirmLabel}</button>
        </footer>
      </form>
    </div>
  );
}
