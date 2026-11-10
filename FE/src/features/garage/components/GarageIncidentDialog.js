import { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Icon from '../../../components/ui/Icon';
import GaragePhotoUpload from './GaragePhotoUpload';

export default function GarageIncidentDialog({
  tasks = [],
  vehicles = [],
  incident,
  onSave,
  onClose,
}) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [bookingId, setBookingId] = useState('');
  const [requestId] = useState(() => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState(incident?.description || '');
  const [severity, setSeverity] = useState(incident?.severity || 'medium');
  const [photos, setPhotos] = useState(incident?.photos || []);
  const [error, setError] = useState('');
  return (
    <Modal
      title={incident ? `Báo cáo ${incident.id}` : 'Tạo báo cáo sự cố'}
      className="gs-dialog"
      onClose={busy || uploading ? () => {} : onClose}
    >
      <p className="gs-dialog-intro">
        Ghi nhận hiện trạng và chuyển bộ phận vận hành tiếp nhận, xác minh.
      </p>
      <form
        className="gs-report-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || uploading) return;
          if (!vehicleId || description.trim().length < 10) {
            setError('Chọn xe và mô tả sự cố ít nhất 10 ký tự.');
            return;
          }
          setBusy(true);
          setError('');
          try { await onSave({
            vehicleId,
            ...(bookingId ? { bookingId } : {}),
            description: description.trim(),
            severity,
            photos,
          }, requestId); }
          catch (failure) { setError(failure.message); }
          finally { setBusy(false); }
        }}
      >
        <fieldset disabled={!!incident || busy || uploading}>
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
                value={vehicleId}
                onChange={(e) => { setVehicleId(e.target.value); setBookingId(''); }}
              >
                <option value="">Chọn xe</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle} · {vehicle.plate}
                  </option>
                ))}
              </select>
            )}
          </label>
          {!incident && <label>Đơn thuê liên quan (nếu có)
            <select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
              <option value="">Không gắn đơn thuê</option>
              {[...new Map(tasks.filter((task) => task.vehicleId === vehicleId && task.bookingId).map((task) => [task.bookingId, task])).values()].map((task) => <option key={task.bookingId} value={task.bookingId}>{task.reference}</option>)}
            </select>
          </label>}
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
          readOnly={!!incident || busy}
          onBusyChange={setUploading}
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
            disabled={busy || uploading}
          >
            Đóng
          </button>
          {!incident && (
            <button type="submit" className="gs-button gs-button-primary" disabled={busy || uploading}>
              <Icon name="arrow" size={15} />
              {busy ? 'Đang gửi...' : 'Gửi bộ phận vận hành'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
