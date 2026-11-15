import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getOwnerSubmission, getOwnerSubmissionFile } from '../api/garageApi';
import GaragePhotoViewer from './GaragePhotoViewer';

function PdfPreview({ file, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return createPortal(<dialog ref={dialog} className="gs-owner-pdf" aria-label={file.name}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><strong>{file.name}</strong><button type="button" onClick={onClose} autoFocus>Đóng</button></header>
    <iframe title={file.name} src={file.url} />
  </dialog>, document.body);
}

export default function GarageOwnerSubmission({ inspectionId }) {
  const [submission, setSubmission] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileError, setFileError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    getOwnerSubmission(inspectionId, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setSubmission(data); })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error.message); });
    return () => controller.abort();
  }, [inspectionId]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let url;
    getOwnerSubmissionFile(inspectionId, selected.id, { signal: controller.signal })
      .then(blob => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setPreview({ name: selected.name, url, pdf: blob.type === 'application/pdf' });
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setFileError(error.message);
          setSelected(null);
        }
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [inspectionId, selected]);

  function closePreview() {
    setPreview(null);
    setSelected(null);
  }

  return <section className="gs-owner-submission">
    <h3>Hồ sơ chủ xe gửi</h3>
    {loadError && <p role="alert">{loadError}</p>}
    {!submission && !loadError && <p role="status">Đang tải hồ sơ chủ xe…</p>}
    {submission && <>
      <dl>
        <div><dt>Hãng và dòng xe</dt><dd>{[submission.brand, submission.model].filter(Boolean).join(' ') || '—'}</dd></div>
        <div><dt>Biển số</dt><dd>{submission.plate || '—'}</dd></div>
        <div><dt>Năm sản xuất</dt><dd>{submission.year || '—'}</dd></div>
        <div><dt>Số VIN</dt><dd>{submission.vin || 'Chưa khai báo'}</dd></div>
      </dl>
      <p><strong>Khai báo hiện trạng</strong></p>
      <p className="gs-owner-declaration">{submission.declaration || 'Chưa có khai báo.'}</p>
      {submission.files.length ? <ul>{submission.files.map(file => <li key={file.id}>
        <button type="button" disabled={Boolean(selected)} onClick={() => {
          setFileError('');
          setSelected(file);
        }}>Xem {file.name.toLowerCase()}</button>
      </li>)}</ul> : <p>Chưa có ảnh hoặc giấy tờ đính kèm.</p>}
    </>}
    {selected && !preview && <p role="status">Đang tải tệp…</p>}
    {fileError && <p role="alert">{fileError}</p>}
    {preview && (preview.pdf
      ? <PdfPreview file={preview} onClose={closePreview} />
      : <GaragePhotoViewer source={preview.url} name={preview.name} onClose={closePreview} />)}
  </section>;
}
