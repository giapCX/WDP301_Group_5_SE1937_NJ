import { useState } from 'react';
import Icon from '../ui/Icon';

export default function GaragePhotoUpload({
  photos,
  onChange,
  readOnly = false,
}) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function attach(event) {
    const files = Array.from(event.target.files);
    event.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > 4) {
      setError('Mỗi biên bản được đính kèm tối đa 4 ảnh.');
      return;
    }
    if (
      files.some(
        (file) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          file.size > 500 * 1024,
      )
    ) {
      setError('Chọn ảnh JPG, PNG hoặc WebP, tối đa 500 KB mỗi ảnh.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const added = await Promise.all(
        files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({ name: file.name, data: reader.result });
              reader.onerror = () =>
                reject(new Error('Không đọc được ảnh. Vui lòng thử lại.'));
              reader.readAsDataURL(file);
            }),
        ),
      );
      onChange([...photos, ...added]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="gs-photo-section">
      <h3>
        Ảnh hiện trạng <span>Không bắt buộc</span>
      </h3>
      {!readOnly && (
        <label className={`gs-photo-drop ${loading ? 'gs-photo-loading' : ''}`}>
          <Icon name="upload" size={23} />
          <strong>
            {loading ? 'Đang đọc ảnh...' : 'Chọn ảnh hiện trạng xe'}
          </strong>
          <small>JPG, PNG, WebP · Tối đa 4 ảnh, 500 KB / ảnh</small>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={attach}
            disabled={loading || photos.length >= 4}
            aria-label="Chọn ảnh hiện trạng xe"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="gs-form-error">
          {error}
        </p>
      )}
      <div className="gs-photo-grid">
        {photos.map((photo, index) => (
          <div key={`${photo.name}-${index}`}>
            <img src={photo.data} alt={photo.name} />
            <span>{photo.name}</span>
            {!readOnly && (
              <button
                type="button"
                aria-label={`Xóa ảnh ${photo.name}`}
                onClick={() => onChange(photos.filter((_, i) => i !== index))}
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
      {readOnly && !photos.length && (
        <p className="gs-muted">Không có ảnh đính kèm.</p>
      )}
    </section>
  );
}
