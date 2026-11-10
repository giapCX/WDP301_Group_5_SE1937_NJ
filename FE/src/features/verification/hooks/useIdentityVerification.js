import { useCallback, useEffect, useState } from 'react';
import { getMyVerification, submitVerification } from '../api/verificationApi';

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({ name: file.name, contentType: file.type, data: reader.result });
  reader.onerror = () => reject(new Error(`Không đọc được tệp ${file.name}.`));
  reader.readAsDataURL(file);
});

export default function useIdentityVerification() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getMyVerification({ signal: controller.signal })
      .then((result) => setData(result.data))
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message || 'Không thể tải trạng thái eKYC.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => refresh(), [refresh]);

  const submit = async (form) => {
    setSaving(true);
    setError('');
    try {
      const [identityFile, licenseFile] = await Promise.all([readFile(form.identityFile), readFile(form.licenseFile)]);
      await submitVerification({
        identity: { documentType: form.documentType, number: form.identityNumber, file: identityFile },
        driverLicense: { number: form.licenseNumber, class: form.licenseClass, expiresAt: form.expiresAt, file: licenseFile },
      });
      refresh();
      return true;
    } catch (reason) {
      setError(reason.message || 'Không thể gửi hồ sơ eKYC.');
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { data, loading, saving, error, submit, refresh };
}
