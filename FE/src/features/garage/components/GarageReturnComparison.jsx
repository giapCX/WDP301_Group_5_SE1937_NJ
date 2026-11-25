import { dateTime } from '../../shared/booking/bookingConstants';
import { CHECKLIST_ITEMS, INSPECTION_RESULTS } from '../garageConstants';
import { InspectionPhotos } from './GarageInspectionRecord';

function measurement(value, unit) {
  return Number.isFinite(value) ? value + unit : '—';
}

function CheckResult({ value }) {
  const label = INSPECTION_RESULTS[value];
  return label
    ? <span className={label === 'Đạt' ? 'garage-compare-pass' : 'garage-compare-fail'}>{label}</span>
    : '—';
}

export default function GarageReturnComparison({ before, after }) {
  const reports = [before, after];
  return (
    <section className="garage-compare" aria-labelledby="garage-compare-title">
      <h2 id="garage-compare-title">Đối chiếu hiện trạng xe</h2>
      <table className="garage-compare-table">
        <thead><tr><th scope="col">Hạng mục</th><th scope="col">Trước chuyến</th><th scope="col">Khi tiếp nhận</th></tr></thead>
        <tbody>
          <tr><th scope="row">Giờ ghi nhận</th>{reports.map((record, i) => <td key={i}>{record ? dateTime(record.inspected_at) : '—'}</td>)}</tr>
          <tr><th scope="row">Số km</th>{reports.map((record, i) => <td key={i}>{measurement(record?.odometer, ' km')}</td>)}</tr>
          <tr><th scope="row">Mức nhiên liệu</th>{reports.map((record, i) => <td key={i}>{measurement(record?.fuel_percent, '%')}</td>)}</tr>
          {CHECKLIST_ITEMS.map(([key, label]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td><CheckResult value={before?.checklist?.[key]} /></td>
              <td><CheckResult value={after?.checklist?.[key]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="garage-compare-evidence">
        {reports.map((record, index) => {
          const title = index === 0 ? 'Trước chuyến' : 'Khi tiếp nhận';
          return (
            <section key={title} aria-label={title}>
              <h3>{title}</h3>
              <p className="garage-check-note">{record?.condition_note || 'Chưa có ghi chú.'}</p>
              <InspectionPhotos inspection={record} />
            </section>
          );
        })}
      </div>
    </section>
  );
}
