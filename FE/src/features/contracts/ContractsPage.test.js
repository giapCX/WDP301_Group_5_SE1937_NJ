import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ContractsPage from './ContractsPage';
import { saveSession } from '../auth/session';
import { getApi, postApi } from '../../services/httpClient';

jest.mock('../../services/httpClient', () => ({ getApi: jest.fn(), postApi: jest.fn() }));
const row = {
  id: 'agreement-1', type: 'management', number: 'MGMT-TEST-1', status: 'pending_signatures',
  vehicle: 'Toyota Vios · 30A-12345', canSign: true,
  document: { hash: 'reviewed-content', version: 'v1', title: 'Hợp đồng quản lý xe', facts: [{ label: 'Hoa hồng', value: '10%' }], clauses: ['Điều khoản đã chốt.'], prepared_at: '2026-11-10T01:00:00Z' },
};
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); getApi.mockReset(); postApi.mockReset();
  saveSession('owner-token', { full_name: 'Nguyễn Văn An', roles: ['OWNER'] }, false);
  getApi.mockImplementation(async (path) => path.includes('/candidates') ? { data: [{ id: 'booking-1', label: 'BK-0001' }], pagination: { page: 1, total: 1 } }
    : path.includes('agreement-1?') ? { data: row } : { data: [row], pagination: { page: 1, total: 1 } });
});
afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

test('owner reviews frozen content, accepts explicitly and signs that exact document', async () => {
  postApi.mockResolvedValue({ data: { ...row, status: 'active', canSign: false, partyName: 'Nguyễn Văn An', partySignedAt: '2026-11-11T01:00:00Z', platformName: 'Manager', platformSignedAt: '2026-11-11T00:00:00Z' } });
  render(<ContractsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Đọc và ký' }));
  const dialog = screen.getByRole('dialog');
  await within(dialog).findByText('Điều khoản đã chốt.');
  expect(within(dialog).getByText('10%')).toBeInTheDocument();
  const sign = within(dialog).getByRole('button', { name: 'Xác nhận ký hợp đồng' });
  expect(sign).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(sign);
  await waitFor(() => expect(postApi).toHaveBeenCalledWith('/contracts/management/agreement-1/sign?view=party', { signatureName: 'Nguyễn Văn An', acceptedTerms: true, documentHash: 'reviewed-content' }));
  await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Xác nhận ký hợp đồng' })).not.toBeInTheDocument());
  expect(within(dialog).getByText(/Manager/)).toBeInTheDocument();
});

test('failed signing remains visible and cannot show a successful signature', async () => {
  postApi.mockRejectedValue(new Error('Nội dung đã thay đổi. Mở lại hợp đồng.'));
  render(<ContractsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Đọc và ký' }));
  const dialog = screen.getByRole('dialog');
  await within(dialog).findByRole('checkbox');
  fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận ký hợp đồng' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nội dung đã thay đổi');
  expect(within(dialog).getByRole('button', { name: 'Xác nhận ký hợp đồng' })).toBeInTheDocument();
});

test('Operation prepares an approved booking and sees no platform signing permission', async () => {
  saveSession('operation-token', { full_name: 'Operation', roles: ['OPERATION_STAFF'] }, false);
  const rental = { ...row, type: 'rental', canSign: false };
  getApi.mockImplementation(async (path) => path.includes('/candidates') ? { data: [{ id: 'booking-1', label: 'BK-0001' }], pagination: { page: 1, total: 1 } }
    : path.includes('agreement-1?') ? { data: rental } : { data: [], pagination: { page: 1, total: 0 } });
  postApi.mockResolvedValue({ data: rental });
  render(<ContractsPage />);
  await screen.findByText('BK-0001');
  fireEvent.change(screen.getByLabelText('Booking chờ ký'), { target: { value: 'booking-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lập / mở hợp đồng' }));
  await waitFor(() => expect(postApi).toHaveBeenCalledWith('/contracts/rental/prepare/booking-1', {}));
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByText('Điều khoản đã chốt.');
  expect(within(dialog).queryByRole('button', { name: 'Xác nhận ký hợp đồng' })).not.toBeInTheDocument();
});
