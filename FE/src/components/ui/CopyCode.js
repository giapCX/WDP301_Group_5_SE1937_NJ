import { useState } from 'react';
import './CopyCode.css';

export default function CopyCode({ value, label }) {
  const [message, setMessage] = useState('');
  if (!value) return '—';

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage('Đã sao chép');
    } catch {
      setMessage('Hãy chọn mã để sao chép thủ công');
    }
  }

  return <span className="copy-code">
    <span>{value}</span>
    <button type="button" aria-label={`Sao chép ${label} ${value}`} onClick={copy}>Sao chép</button>
    <span role="status">{message}</span>
  </span>;
}
