import { useEffect, useState } from 'react';
import { getGaragePhoto } from '../api/garageApi';
import GaragePhotoViewer from './GaragePhotoViewer';

export default function GaragePhotoPreview({ photo }) {
  const [source, setSource] = useState('');
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
    setError(false);
    if (photo.data) { setSource(photo.data); return; }
    const controller = new AbortController();
    let url;
    setError(false);
    setSource('');
    getGaragePhoto(photo.key, { signal: controller.signal }).then((blob) => {
      if (!controller.signal.aborted) { url = URL.createObjectURL(blob); setSource(url); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [photo.key, photo.data]);
  return source ? <>
    <button type="button" className="gs-photo-preview" aria-label={`Xem ảnh ${photo.name}`} onClick={() => setOpen(true)}>
      <img src={source} alt={photo.name} />
    </button>
    {open && <GaragePhotoViewer source={source} name={photo.name} onClose={() => setOpen(false)} />}
  </> : <span>{error ? 'Ảnh chưa có tệp hoặc không tải được' : 'Đang tải ảnh...'}</span>;
}
