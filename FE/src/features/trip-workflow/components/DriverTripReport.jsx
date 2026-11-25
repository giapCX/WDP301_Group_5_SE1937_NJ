import { useState } from 'react';
import { workflowError } from '../api/tripWorkflowApi';

export default function DriverTripReport({ startOdometer, busy, onReport }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const hasStartOdometer = Number.isFinite(startOdometer);
  const minOdometer = hasStartOdometer ? startOdometer : 0;

  function close() {
    setOpen(false);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const rawOdometer = fields.get('end_odometer');
    const end_odometer = Number(rawOdometer);
    const summary = (fields.get('summary') || '').trim();

    if (!rawOdometer || !Number.isFinite(end_odometer) || end_odometer < 0) {
      setError('Vui lòng nhập số km cuối hợp lệ.');
      return;
    }
    if (end_odometer < minOdometer) {
      setError('Số km cuối phải lớn hơn hoặc bằng số km lúc nhận xe.');
      return;
    }
    setError('');
    try {
      await onReport({ end_odometer, summary });
      close();
    } catch (failure) {
      setError(workflowError(failure));
    }
  }

  if (!open) {
    return (
      <button type="button" disabled={busy} onClick={() => setOpen(true)}>
        Xác nhận trả khách &amp; gửi báo cáo
      </button>
    );
  }

  return (
    <form className="workflow-form driver-action-form" aria-label="Báo cáo sau chuyến" onSubmit={submit} noValidate>
      <label>
        Số km cuối (km)
        <input name="end_odometer" type="number" min={minOdometer} step="any" required disabled={busy} autoFocus />
      </label>
      {hasStartOdometer && <p className="workflow-muted">Số km lúc nhận xe {startOdometer.toLocaleString('vi-VN')} km</p>}
      <label>
        Ghi chú sau chuyến (không bắt buộc)
        <textarea name="summary" rows={3} maxLength={2000} disabled={busy} />
      </label>
      {error && <p className="dispatch-alert" role="alert">{error}</p>}
      <div className="driver-action-buttons">
        <button type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi báo cáo'}</button>
        <button type="button" className="workflow-secondary" disabled={busy} onClick={close}>Hủy</button>
      </div>
    </form>
  );
}
