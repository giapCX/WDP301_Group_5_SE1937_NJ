import { useState } from 'react';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import GaragePhotoUpload from './GaragePhotoUpload';

export default function GarageIncidentDialog({
  tasks,
  incident,
  onSave,
  onClose,
}) {
  const [taskId, setTaskId] = useState(tasks[0]?.id || '');
  const [description, setDescription] = useState(incident?.description || '');
  const [severity, setSeverity] = useState(incident?.severity || 'medium');
  const [photos, setPhotos] = useState(incident?.photos || []);
  const [error, setError] = useState('');
  return (
    <Modal
      title={incident ? `Báo cáo ${incident.id}` : 'Tạo báo cáo sự cố'}
      className="gs-dialog"
      onClose={onClose}
    >
      <p className="gs-dialog-intro">
        Ghi nhận hiện trạng và chuyển bộ phận vận hành tiếp nhận, xác minh.
      </p>
      <form
        className="gs-report-form"
        onSubmit={(e) => {
          e.preventDefault();
          const task = tasks.find((item) => item.id === taskId);
          if (!task || description.trim().length < 10) {
            setError('Chọn xe và mô tả sự cố ít nhất 10 ký tự.');
            return;
          }
          onSave({
            taskId,
            vehicle: task.vehicle,
            plate: task.plate,
            description: description.trim(),
            severity,
            photos,
          });
        }}
      >
        <fieldset disabled={!!incident}>
          <legend className="gs-form-section-title">
            <span>Thông tin sự cố</span>
          </legend>
          <label>
            Xe liên quan
            {incident ? (
              <input
                value={`${incident.vehicle} · ${incident.plate}`}
                readOnly
              />
            ) : (
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.vehicle} · {task.plate}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label>
            Mức độ ghi nhận
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="low">Nhẹ · Cần theo dõi</option>
              <option value="medium">Trung bình · Cần kiểm tra</option>
              <option value="high">Nghiêm trọng · Cần xử lý sớm</option>
            </select>
          </label>
          <label>
            Mô tả sự cố
            <textarea
              rows="5"
              maxLength="1500"
              placeholder="Vị trí hư hỏng, thời điểm phát hiện, tình trạng xe..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </fieldset>
        <GaragePhotoUpload
          photos={photos}
          onChange={setPhotos}
          readOnly={!!incident}
        />
        {error && (
          <p role="alert" className="gs-form-error">
            {error}
          </p>
        )}
        <div className="gs-dialog-actions">
          <button
            type="button"
            className="gs-button gs-button-secondary"
            onClick={onClose}
          >
            Đóng
          </button>
          {!incident && (
            <button type="submit" className="gs-button gs-button-primary">
              <Icon name="arrow" size={15} />
              Gửi bộ phận vận hành
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
