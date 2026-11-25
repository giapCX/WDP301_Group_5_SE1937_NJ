import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ContractDocument from './PassengerContractPaper';
import './passengerContract.css';

export default function SignedContractView({ contract }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.querySelector('button').focus();

    function handleKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  const status = contract.status === 'active' ? 'đã kích hoạt'
    : contract.status === 'cancelled' ? 'đã hủy' : 'đã ký, chờ thanh toán';

  return <section>
    <h3>Hợp đồng {status}</h3>
    <button className="rv-button" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      Xem bản đã ký
    </button>
    {open && createPortal(
      <div className="passenger-signing-backdrop" onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}>
        <div ref={dialog} className="passenger-signing" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <header className="passenger-signing-header">
            <div><span>HỢP ĐỒNG {status.toLocaleUpperCase('vi-VN')}</span><h2 id={titleId}>Bản hợp đồng đã ký</h2></div>
            <button className="rv-button" type="button" onClick={() => setOpen(false)}>Đóng hợp đồng</button>
          </header>
          <div className="passenger-paper-scroll" tabIndex={0} aria-label="Nội dung hợp đồng đã ký có thể cuộn">
            <ContractDocument document={contract.document} signature={contract}/>
          </div>
        </div>
      </div>, document.body,
    )}
  </section>;
}
