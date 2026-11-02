import { useState } from 'react';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import GaragePhotoUpload from './GaragePhotoUpload';
import GarageStatus from './GarageStatus';
import {
  conditionFields,
  conditionLabels,
  displayDate,
  displayTime,
  taskBlockers,
  taskKinds,
  validateGarageReport,
} from '../../data/garage';

export default function GarageReportDialog({ task, onSave, onClose }) {
  const [report, setReport] = useState(() => ({
    odometer: String(task.odometer),
    fuel: String(task.fuel),
    exterior: '',
    interior: '',
    engine: '',
    tires: '',
    recommendation: '',
    note: '',
    confirmed: false,
    photos: [],
    ...task.report,
  }));
  const [error, setError] = useState('');
  const readOnly = ['completed', 'submitted'].includes(task.status);
  const blockers = taskBlockers(task);
  const set = (key, value) =>
    setReport((previous) => ({ ...previous, [key]: value }));
  const submitLabel =
    task.kind === 'inspection'
      ? 'Gửi đề xuất kiểm định'
      : task.kind === 'intake'
        ? 'Xác nhận tiếp nhận xe'
        : task.kind === 'handover'
          ? 'Xác nhận bàn giao xe'
          : 'Xác nhận nhận trả xe';
  const confirmLabel =
    task.kind === 'intake'
      ? 'Đã ghi nhận xác nhận bàn giao của chủ xe'
      : task.kind === 'handover'
        ? 'Khách thuê đã xác nhận nhận xe và tình trạng bàn giao'
        : 'Đã ghi nhận xác nhận trả xe của khách thuê';
  function submit(event) {
    event.preventDefault();
    const message = validateGarageReport(task, report);
    if (message) {
      setError(message);
      return;
    }
    onSave(task.id, report, false);
  }
  return (
    <Modal
      title={`${taskKinds[task.kind]} · ${task.id}`}
      className="gs-dialog"
      onClose={onClose}
    >
      <div className="gs-report-vehicle">
        <span className={`gs-car-tile gs-car-tile--${task.kind}`}>
          <Icon name="car" size={30} />
        </span>
        <div>
          <h3>{task.vehicle}</h3>
          <p>
            {task.plate} · {task.reference}
          </p>
        </div>
        <GarageStatus
          status={task.status}
          blocked={blockers.length > 0 && !readOnly}
        />
      </div>
      <div className="gs-report-facts">
        <div>
          <small>
            {['intake', 'inspection'].includes(task.kind)
              ? 'CHỦ XE'
              : 'KHÁCH THUÊ'}
          </small>
          <strong>{task.contact}</strong>
        </div>
        <div>
          <small>LỊCH HẸN</small>
          <strong>
            {displayTime(task.schedule)} · {displayDate(task.schedule)}
          </strong>
        </div>
        <div>
          <small>ĐỊA ĐIỂM</small>
          <strong>{task.location}</strong>
        </div>
        <div>
          <small>VỊ TRÍ XE</small>
          <strong>{task.bay}</strong>
        </div>
      </div>
      {blockers.length > 0 && !readOnly && (
        <div className="gs-blocker">
          <Icon name="alert" size={20} />
          <div>
            <strong>Chưa đủ điều kiện hoàn tất</strong>
            {blockers.map((message) => (
              <p key={message}>{message}</p>
            ))}
            <small>Bạn có thể chuẩn bị và lưu nháp biên bản.</small>
          </div>
        </div>
      )}
      {task.kind === 'return' && (
        <div className="gs-return-baseline">
          <Icon name="history" size={17} />
          <span>
            Khi giao xe:{' '}
            <strong>{task.odometer.toLocaleString('vi-VN')} km</strong> · Nhiên
            liệu / pin <strong>{task.fuel}%</strong>
          </span>
        </div>
      )}
      {readOnly && !task.report ? (
        <div className="gs-empty">
          <Icon name="check" size={30} />
          <h3>Công việc mẫu đã hoàn thành</h3>
          <p>Chọn một công việc chờ thực hiện để thử lập biên bản.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="gs-report-form">
          <fieldset disabled={readOnly}>
            <legend className="gs-form-section-title">
              01{' '}
              <span>
                Chỉ số tại thời điểm{' '}
                {task.kind === 'return' ? 'nhận trả' : 'kiểm tra'}
              </span>
            </legend>
            <div className="gs-form-grid">
              <label>
                Số km trên đồng hồ
                <input
                  aria-label="Số km trên đồng hồ"
                  type="number"
                  min={task.odometer}
                  step="1"
                  value={report.odometer}
                  onChange={(e) => set('odometer', e.target.value)}
                />
                <small>
                  Đã ghi nhận: {task.odometer.toLocaleString('vi-VN')} km
                </small>
              </label>
              <label>
                Nhiên liệu / pin (%)
                <input
                  aria-label="Nhiên liệu / pin (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={report.fuel}
                  onChange={(e) => set('fuel', e.target.value)}
                />
                <small>Mức hiện tại từ 0 đến 100%</small>
              </label>
            </div>
          </fieldset>
          <fieldset disabled={readOnly}>
            <legend className="gs-form-section-title">
              02 <span>Tình trạng xe</span>
            </legend>
            {!readOnly && (
              <button
                type="button"
                className="gs-text-link gs-normal-button"
                onClick={() =>
                  setReport((previous) => ({
                    ...previous,
                    ...Object.fromEntries(
                      conditionFields.map(([key]) => [key, 'good']),
                    ),
                  }))
                }
              >
                <Icon name="check" size={14} />
                Tất cả bình thường
              </button>
            )}
            <div className="gs-form-grid">
              {conditionFields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <select
                    value={report[key]}
                    onChange={(e) => set(key, e.target.value)}
                  >
                    <option value="">Chọn đánh giá</option>
                    {Object.entries(conditionLabels).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="gs-note-label">
              Ghi chú tình trạng
              <textarea
                rows="3"
                maxLength="1500"
                placeholder="Mô tả vị trí, tình trạng hoặc điểm cần lưu ý..."
                value={report.note}
                onChange={(e) => set('note', e.target.value)}
              />
            </label>
          </fieldset>
          <GaragePhotoUpload
            photos={report.photos}
            onChange={(photos) => set('photos', photos)}
            readOnly={readOnly}
          />
          <fieldset disabled={readOnly}>
            <legend className="gs-form-section-title">
              03{' '}
              <span>
                {task.kind === 'inspection'
                  ? 'Đề xuất kiểm định'
                  : 'Xác nhận giao nhận'}
              </span>
            </legend>
            {task.kind === 'inspection' ? (
              <>
                <div className="gs-recommendations">
                  {[
                    ['pass', 'Đề xuất đạt'],
                    ['revision', 'Yêu cầu bổ sung'],
                    ['reject', 'Không đạt'],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className={
                        report.recommendation === value
                          ? 'gs-choice-active'
                          : ''
                      }
                    >
                      <input
                        type="radio"
                        name="recommendation"
                        value={value}
                        checked={report.recommendation === value}
                        onChange={() => set('recommendation', value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="gs-form-hint">
                  <Icon name="shield" size={15} />
                  Đề xuất sẽ được chuyển cho Manager phê duyệt.
                </p>
              </>
            ) : (
              <label className="gs-confirm-row">
                <input
                  type="checkbox"
                  checked={report.confirmed}
                  onChange={(e) => set('confirmed', e.target.checked)}
                />
                {confirmLabel}
              </label>
            )}
            {task.kind === 'return' && (
              <p className="gs-form-hint">
                Nếu có bất thường, hệ thống sẽ tạo báo cáo để bộ phận vận hành
                tiếp nhận. Không tự quyết định bồi thường hoặc hoàn cọc.
              </p>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="gs-form-error">
              {error}
            </p>
          )}
          {!readOnly && (
            <div className="gs-dialog-actions">
              <button
                type="button"
                className="gs-button gs-button-secondary"
                onClick={() => onSave(task.id, report, true)}
              >
                Lưu bản nháp
              </button>
              <button
                type="submit"
                className="gs-button gs-button-primary"
                disabled={blockers.length > 0}
              >
                <Icon name="check" size={16} />
                {submitLabel}
              </button>
            </div>
          )}
        </form>
      )}
      {readOnly && (
        <div className="gs-dialog-actions">
          <span className="gs-muted">
            Biên bản đã gửi được mở ở chế độ chỉ xem.
          </span>
          <button className="gs-button gs-button-secondary" onClick={onClose}>
            Đóng biên bản
          </button>
        </div>
      )}
    </Modal>
  );
}
