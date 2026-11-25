import { useState } from 'react';
import apiClient from '../../../api/client';
import useHomeResource from '../../home/hooks/useHomeResource';
import { managerDashboardError } from '../api/managerDashboardApi';
import '../../management/styles/management.css';

const endpoint = '/manager/dashboard/contract-profile';
async function loadProfile(_params, signal) {
  return (await apiClient.get(endpoint, { signal })).data;
}

export default function ContractCompanyProfile() {
  const profile = useHomeResource(loadProfile);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  if (profile.loading) return <p role="status">Đang tải hồ sơ…</p>;
  if (profile.error) return <p role="alert">{managerDashboardError(profile.error)}</p>;

  async function save(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await apiClient.put(endpoint, Object.fromEntries(fields));
      setNotice('Đã lưu. Các báo giá gửi tiếp theo tự dùng thông tin này; hợp đồng đã gửi giữ nguyên.');
    } catch (failure) {
      setError(managerDashboardError(failure));
    } finally {
      setBusy(false);
    }
  }

  return <section className="manager-panel">
    <p>Thiết lập một lần để Operator gửi hợp đồng. Người đại diện và chức vụ được lấy từ tài khoản Manager này.</p>
    <p><strong>Người đại diện bên A:</strong> {profile.data.representative} · Manager</p>
    <form onSubmit={save}>
      <fieldset disabled={busy}>
        {Object.entries({ name: 'Tên đơn vị vận tải', address: 'Địa chỉ đơn vị', taxId: 'Mã số thuế', phone: 'Điện thoại liên hệ Manager / đơn vị' }).map(([key, label]) => (
          <label key={key} className="d-block mb-3">{label}
            <input className="form-control" required name={key} maxLength={key === 'phone' ? 20 : 255} defaultValue={profile.data[key]}/>
          </label>
        ))}
        <button className="manager-button manager-button-primary" type="submit">{busy ? 'Đang lưu…' : 'Lưu hồ sơ hợp đồng'}</button>
      </fieldset>
    </form>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
