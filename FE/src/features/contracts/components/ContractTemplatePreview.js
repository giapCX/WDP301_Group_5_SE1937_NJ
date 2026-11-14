import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { getContractTemplate } from '../api/contractsApi';
import { contractTemplate } from '../contractPresentation';
import '../contracts.css';

export default function ContractTemplatePreview({ type }) {
  const template = contractTemplate[type] || contractTemplate.management;
  const documentRef = useRef(null), styleRef = useRef(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function loadTemplate() {
      setLoading(true);
      setError('');
      try {
        const content = await getContractTemplate(template.url, controller.signal);
        if (controller.signal.aborted || !documentRef.current || !styleRef.current) return;
        documentRef.current.replaceChildren();
        styleRef.current.replaceChildren();
        await renderAsync(content, documentRef.current, styleRef.current, { breakPages: true });
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason.message || 'Không thể hiển thị file mẫu hợp đồng.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadTemplate();
    return () => controller.abort();
  }, [template.url]);
  return <section className="contract-template-preview" aria-label={template.title}>
    <header className="contract-template-header"><div><span className="contract-eyebrow">FILE WORD GỐC</span><h3>{template.title}</h3></div><a className="contract-button contract-button--secondary" href={template.url} download={template.fileName}>Tải file DOCX</a></header>
    <div ref={styleRef} className="contract-template-styles" />
    {loading && <div className="contract-loading" role="status"><span className="contract-spinner" />Đang mở file Word…</div>}
    {error && <p className="contract-alert" role="alert">{error}</p>}
    <div ref={documentRef} className="contract-template-document" />
  </section>;
}

