import { useState } from 'react';
import { resubmitVehicleDocuments } from '../api/ownerApi';

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, contentType: file.type, data: reader.result });
    reader.onerror = () => reject(new Error(`Không thể đọc tệp ${file.name}.`));
    reader.readAsDataURL(file);
  });

export default function VehicleRevisionDialog({ vehicle, onClose, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState({
    registration: null,
    inspectionCertificate: null,
    insurance: null,
  });
  const [photos, setPhotos] = useState([]);
  const [note, setNote] = useState('');

  if (!vehicle) return null;

  const docItems = [
    { key: 'registration', label: 'Giấy đăng ký xe', current: vehicle.documents?.registration },
    { key: 'inspectionCertificate', label: 'Giấy chứng nhận đăng kiểm', current: vehicle.documents?.inspectionCertificate },
    { key: 'insurance', label: 'Giấy chứng nhận bảo hiểm', current: vehicle.documents?.insurance },
  ];

  const onFileChange = (key, event) => {
    const file = event.target.files?.[0] || null;
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const onPhotosChange = (event) => {
    const selected = Array.from(event.target.files || []).slice(0, 5);
    setPhotos(selected);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const hasAnyFile = files.registration || files.inspectionCertificate || files.insurance || photos.length > 0;
    if (!hasAnyFile) {
      setError('Vui lòng chọn ít nhất một tệp giấy tờ hoặc ảnh xe cần thay thế/bổ sung.');
      return;
    }

    if (photos.length > 0 && photos.length < 2) {
      setError('Nếu thay đổi ảnh xe, vui lòng tải lên từ 2 đến 5 ảnh ngoại thất hoặc nội thất.');
      return;
    }

    setBusy(true);
    try {
      const documentsPayload = {};
      if (files.registration) {
        documentsPayload.registration = await readFile(files.registration);
      }
      if (files.inspectionCertificate) {
        documentsPayload.inspectionCertificate = await readFile(files.inspectionCertificate);
      }
      if (files.insurance) {
        documentsPayload.insurance = await readFile(files.insurance);
      }

      let photosPayload;
      if (photos.length >= 2) {
        photosPayload = await Promise.all(photos.map(readFile));
      }

      await resubmitVehicleDocuments(vehicle.id, {
        documents: documentsPayload,
        photos: photosPayload,
        note: note.trim(),
      });

      onSuccess(`Đã gửi tài liệu bổ sung cho xe ${vehicle.brand} ${vehicle.model} (${vehicle.licensePlate}). Quản lý sẽ xem xét lại hồ sơ.`);
      onClose();
    } catch (err) {
      setError(err.message || 'Không thể gửi tài liệu bổ sung.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="owner-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="owner-modal owner-revision-dialog" role="dialog" aria-modal="true">
        <header className="owner-modal-head">
          <div>
            <span className="owner-eyebrow">YÊU CẦU BỔ SUNG TÀI LIỆU</span>
            <h2>{vehicle.brand} {vehicle.model} · {vehicle.licensePlate}</h2>
            <p>Tải lên lại tài liệu hoặc ảnh xe được Quản lý yêu cầu chỉnh sửa.</p>
          </div>
          <button className="owner-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>

        {vehicle.reviewNote && (
          <div className="owner-revision-manager-note">
            <strong>Yêu cầu từ Quản lý xét duyệt:</strong>
            <p>{vehicle.reviewNote}</p>
          </div>
        )}

        {error && (
          <div className="owner-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="owner-form">
          <div className="owner-revision-docs">
            {docItems.map(({ key, label, current }) => {
              const isNeedsRevision = current?.reviewStatus === 'revision_required' || !current?.verified;
              return (
                <div key={key} className={`owner-revision-field-card ${isNeedsRevision ? 'needs-revision' : ''}`}>
                  <div className="owner-revision-field-header">
                    <div>
                      <strong>{label}</strong>
                      <span className={`doc-tag ${current?.verified ? 'verified' : isNeedsRevision ? 'revision' : 'pending'}`}>
                        {current?.verified ? '✓ Đã xác minh' : current?.reviewStatus === 'revision_required' ? '! Cần bổ sung' : 'Chờ duyệt'}
                      </span>
                    </div>
                    {current?.reviewNote && <small className="doc-note">{current.reviewNote}</small>}
                  </div>
                  <div className="owner-revision-upload-row">
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => onFileChange(key, e)}
                    />
                    <small>{files[key]?.name ? `Đã chọn: ${files[key].name}` : 'Chọn tệp thay thế (PDF/ảnh tối đa 4 MB)'}</small>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="owner-revision-photos-section">
            <label className="owner-field">
              <span>Bổ sung/thay thế ảnh xe (Tùy chọn: 2 - 5 ảnh)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={onPhotosChange}
              />
              <small>{photos.length ? `${photos.length} ảnh đã chọn` : 'Chỉ chọn nếu Quản lý yêu cầu chụp lại ảnh xe'}</small>
            </label>
          </div>

          <label className="owner-field">
            <span>Ghi chú giải trình của chủ xe (Tùy chọn)</span>
            <textarea
              rows="3"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Đã quét lại bản PDF có dấu đỏ rõ nét, hạn đăng kiểm đến 2027..."
              maxLength="500"
            />
          </label>

          <footer className="owner-modal-actions">
            <button type="button" className="owner-secondary" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="submit" className="owner-primary" disabled={busy}>
              {busy ? 'Đang tải lên & gửi…' : 'Gửi hồ sơ bổ sung'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

