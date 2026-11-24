export function GarageRepairForm({ maintenance, needsApproval, busy, onSave, onCancel }) {
  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      repair_work: data.get('work'),
      repair_result: data.get('result'),
      affects_safety: data.has('safety'),
    });
  }

  return (
    <form className="garage-check-form" onSubmit={submit}>
      <fieldset className="garage-check-fields" disabled={busy}>
        <legend>Kết quả sửa chữa</legend>
        <label>Công việc đã thực hiện<textarea name="work" rows={2} maxLength={1000} defaultValue={maintenance.repair_work} required /></label>
        <label>Kết quả sửa chữa<textarea name="result" rows={2} maxLength={1000} defaultValue={maintenance.repair_result} required /></label>
        {!needsApproval && <label className="garage-safety-option"><input type="checkbox" name="safety" /> Ảnh hưởng an toàn</label>}
        <div className="garage-maintenance-actions">
          <button className="dispatch-button primary compact">Lưu kết quả sửa chữa</button>
          <button className="dispatch-button subtle compact" type="button" onClick={onCancel}>Hủy</button>
        </div>
      </fieldset>
    </form>
  );
}

export function GarageReinspectionForm({ busy, onSave, onCancel }) {
  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      condition_note: data.get('note'),
      odometer: Number(data.get('odometer')),
      result: data.get('result'),
    });
  }

  return (
    <form className="garage-check-form" onSubmit={submit}>
      <fieldset className="garage-check-fields" disabled={busy}>
        <legend>Kiểm tra sau sửa chữa</legend>
        <label>Tình trạng xe<textarea name="note" rows={2} maxLength={1000} required /></label>
        <label>Số km<input name="odometer" type="number" min="0" step="0.1" required /></label>
        <label>Kết quả kiểm tra
          <select name="result" defaultValue="" required>
            <option value="" disabled>Chọn kết quả</option>
            <option value="passed">Đạt</option>
            <option value="failed">Không đạt</option>
          </select>
        </label>
        <div className="garage-maintenance-actions">
          <button className="dispatch-button primary compact">Lưu kiểm tra</button>
          <button className="dispatch-button subtle compact" type="button" onClick={onCancel}>Hủy</button>
        </div>
      </fieldset>
    </form>
  );
}
