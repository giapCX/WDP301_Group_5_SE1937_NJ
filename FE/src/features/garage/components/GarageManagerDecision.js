export default function GarageManagerDecision({ task }) {
  const entries = [];
  if (task.decisionReason) entries.push({ label: task.status === 'rejected' ? 'Lý do từ chối kiểm định' : task.status === 'revision_required' ? 'Yêu cầu kiểm định lại' : 'Quyết định kiểm định của Manager', reason: task.decisionReason });
  if (task.vehicleReviewNote && task.vehicleReviewNote !== task.decisionReason) entries.push({
    label: task.vehicleReviewStatus === 'rejected' ? 'Lý do từ chối hồ sơ xe' : task.vehicleReviewStatus === 'revision_required' ? 'Yêu cầu bổ sung hồ sơ xe' : 'Ghi chú hồ sơ xe',
    reason: task.vehicleReviewNote,
  });
  if (!entries.length) return null;
  return <div className="gs-manager-decision">{entries.map(({ label, reason }) => <p key={label}><strong>{label}: </strong><span>{reason}</span></p>)}</div>;
}
