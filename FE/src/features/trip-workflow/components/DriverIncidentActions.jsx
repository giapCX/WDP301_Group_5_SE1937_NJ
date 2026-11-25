import { useId, useState } from 'react';
import { workflowError } from '../api/tripWorkflowApi';

const INCIDENT_TYPES = {
  other: {
    label: 'Báo sự cố / yêu cầu hỗ trợ',
    description: 'Mô tả sự cố và hỗ trợ cần thiết',
  },
  customer_route_change: {
    label: 'Khách đổi điểm dừng',
    description: 'Ghi điểm dừng hiện tại và điểm khách muốn đổi sang',
  },
  vehicle_failure: {
    label: 'Báo xe hỏng',
    description: 'Mô tả hỏng xe và vị trí hiện tại',
    danger: true,
  },
};

export default function DriverIncidentActions({ busy, onReport }) {
  const formId = useId();
  const [kind, setKind] = useState('');
  const [error, setError] = useState('');
  const incident = INCIDENT_TYPES[kind];

  function selectKind(nextKind) {
    setKind(nextKind);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    const description = new FormData(event.currentTarget).get('description').trim();
    if (!description) {
      setError('Vui lòng nhập nội dung báo cáo.');
      return;
    }
    setError('');
    try {
      await onReport({ kind, description });
      selectKind('');
    } catch (failure) {
      setError(workflowError(failure));
    }
  }

  return (
    <>
      {Object.entries(INCIDENT_TYPES).map(([key, item]) => (
        <button key={key} type="button" className={item.danger ? 'workflow-danger' : 'workflow-secondary'}
          disabled={busy} aria-expanded={key === kind}
          aria-controls={key === kind ? formId : undefined}
          onClick={() => selectKind(key)}>
          {item.label}
        </button>
      ))}
      {incident && (
        <form key={kind} id={formId} className="workflow-form driver-action-form"
          aria-label={incident.label} onSubmit={submit} noValidate>
          <label>
            {incident.description}
            <textarea name="description" rows={3} maxLength={2000} required disabled={busy} autoFocus />
          </label>
          {error && <p className="dispatch-alert" role="alert">{error}</p>}
          <div className="driver-action-buttons">
            <button type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi báo cáo'}</button>
            <button type="button" className="workflow-secondary" disabled={busy} onClick={() => selectKind('')}>Hủy</button>
          </div>
        </form>
      )}
    </>
  );
}
