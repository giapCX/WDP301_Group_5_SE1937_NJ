import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/ui/Icon';

export default function GaragePhotoViewer({ source, name, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="gs-photo-viewer"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <header className="gs-photo-viewer-heading">
        <div>
          <h2 id={titleId}>Ảnh hiện trạng</h2>
          <p title={name}>{name}</p>
        </div>
        <div className="gs-photo-viewer-actions">
          <button type="button" aria-pressed={zoomed} onClick={() => setZoomed((value) => !value)}>
            {zoomed ? 'Vừa màn hình' : 'Phóng to 2×'}
          </button>
          <button type="button" aria-label="Đóng ảnh" onClick={onClose} autoFocus>
            <Icon name="close" size={20} />
          </button>
        </div>
      </header>
      <div className={`gs-photo-viewer-stage${zoomed ? ' is-zoomed' : ''}`} tabIndex={0} aria-label="Vùng xem ảnh">
        <img src={source} alt={name} />
      </div>
    </dialog>,
    document.body,
  );
}
