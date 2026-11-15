import { useEffect, useId, useRef } from 'react';
import Icon from './Icon';
export default function Modal({ title, children, onClose, className = '' }) {
  const titleId = useId();
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      className={`modal ${className}`}
      aria-labelledby={titleId}
      ref={ref}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button className="close-button" aria-label="Đóng" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
