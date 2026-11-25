import { useId } from 'react';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ content_type: file.type, base64: reader.result.split(',')[1] });
    reader.onerror = () => reject(new Error('Không thể đọc ảnh đã chọn.'));
    reader.readAsDataURL(file);
  });
}

export function encodePhotos(form) {
  return Promise.all(form.getAll('photos').map(readPhoto));
}

export default function GaragePhotoInput({ label, onError }) {
  const hintId = useId();

  function checkPhotos(event) {
    const files = Array.from(event.target.files);
    let message = '';
    if (files.length > 3) message = 'Chỉ chọn tối đa 3 ảnh.';
    else if (files.some((file) => !IMAGE_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES)) {
      message = 'Ảnh phải là JPG hoặc PNG và tối đa 2 MB mỗi ảnh.';
    }
    event.target.setCustomValidity(message);
    onError(message);
  }

  return (
    <>
      <label>
        {label}
        <input name="photos" type="file" multiple required accept={IMAGE_TYPES.join(',')}
          onChange={checkPhotos} aria-describedby={hintId}
        />
      </label>
      <p id={hintId} className="garage-check-hint">1–3 ảnh JPG hoặc PNG, tối đa 2 MB mỗi ảnh.</p>
    </>
  );
}
