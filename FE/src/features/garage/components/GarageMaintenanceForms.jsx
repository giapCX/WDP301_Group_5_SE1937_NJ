export function GarageRepairForm({ maintenance, needsApproval, busy, onSave, onCancel, onError }) {
  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const work = data.get('work').trim();
    const result = data.get('result').trim();
    if (!work || !result) {
      onError('Vui lòng nhập công việc đã thực hiện và kết quả sửa chữa.');
      return;
    }
    onSave({
      repair_work: work,
      repair_result: result,
      affects_safety: data.has('safety'),
    });
  }

  return (
    <form className="garage-check-form" onSubmit={submit} noValidate>
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

export function GarageReinspectionForm({ busy, onSave, onCancel, onError }) {
  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const note = data.get('note').trim();
    const rawOdometer = data.get('odometer');
    const odometer = Number(rawOdometer);
    const result = data.get('result');
    if (!note) return onError('Vui lòng nhập tình trạng xe sau sửa chữa.');
    if (!rawOdometer || !Number.isFinite(odometer) || odometer < 0) {
      return onError('Vui lòng nhập số km hợp lệ, lớn hơn hoặc bằng 0.');
    }
    if (!result) return onError('Vui lòng chọn kết quả kiểm tra.');
    onSave({ condition_note: note, odometer, result });
  }

  return (
    <form className="garage-check-form" onSubmit={submit} noValidate>
      <fieldset className="garage-check-fields" disabled={busy}>
        <legend>Kiểm tra sau sửa chữa</legend>
        <label>Tình trạng xe<textarea name="note" rows={2} maxLength={1000} required /></label>
        <label>Số km<input name="odometer" type="number" min="0" step="any" required /></label>
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
