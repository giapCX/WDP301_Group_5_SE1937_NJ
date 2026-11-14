import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ContractsPage from './ContractsPage';
import { saveSession } from '../auth/session';
import { getApi, postApi } from '../../services/httpClient';
import { renderAsync } from 'docx-preview';

jest.mock('../../services/httpClient', () => ({ getApi: jest.fn(), postApi: jest.fn() }));
jest.mock('docx-preview', () => ({ renderAsync: jest.fn() }));
const row = {
  id: 'agreement-1', type: 'management', number: 'MGMT-TEST-1', status: 'pending_signatures',
  vehicle: 'Toyota Vios · 30A-12345', canSign: true,
  document: { hash: 'reviewed-content', version: 'v1', title: 'Hợp đồng quản lý xe', facts: [{ label: 'Hoa hồng', value: '10%' }], clauses: ['Điều khoản đã chốt.'], prepared_at: '2026-11-10T01:00:00Z' },
};
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); getApi.mockReset(); postApi.mockReset();
  renderAsync.mockReset().mockResolvedValue(undefined);
  saveSession('owner-token', { full_name: 'Nguyễn Văn An', roles: ['OWNER'] }, false);
  getApi.mockImplementation(async (path) => path.includes('/candidates') ? { data: [{ id: 'booking-1', label: 'BK-0001' }], pagination: { page: 1, total: 1 } }
    : path.includes('agreement-1?') ? { data: row } : { data: [row], pagination: { page: 1, total: 1 } });
});
const originalFetch = global.fetch;
afterEach(() => { localStorage.clear(); sessionStorage.clear(); global.fetch = originalFetch; });

test('owner reviews frozen content, accepts explicitly and signs that exact document', async () => {
  postApi.mockResolvedValue({ data: { ...row, status: 'active', canSign: false, partyName: 'Nguyễn Văn An', partySignedAt: '2026-11-11T01:00:00Z', platformName: 'Manager', platformSignedAt: '2026-11-11T00:00:00Z' } });
  render(<ContractsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Đọc và ký' }));
  const dialog = screen.getByRole('dialog');
  await within(dialog).findByText('Điều khoản đã chốt.');
  expect(within(dialog).getByRole('button', { name: 'In / lưu PDF' })).toBeInTheDocument();
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

test('Operator Staff can confirm receipt but does not sign the platform contract', async () => {
  saveSession('operation-token', {
    full_name: 'Operation',
    roles: ['OPERATION_STAFF'],
    permissions: ['operation.contract.read', 'operation.contract.intake.confirm'],
  }, false);
  const operatorRow = { ...row, canSign: false, canOperatorConfirm: true, partySigned: true, partySignedAt: '2026-11-11T01:00:00Z' };
  getApi.mockImplementation(async (path) => path.includes('agreement-1?')
    ? { data: operatorRow }
    : path.startsWith('/contracts/rental')
      ? { data: [], pagination: { page: 1, limit: 10, total: 0 } }
      : { data: [operatorRow], pagination: { page: 1, limit: 10, total: 1 } });
  postApi.mockResolvedValue({ data: { ...operatorRow, canOperatorConfirm: false, operatorIntakeConfirmedAt: '2026-11-11T02:00:00Z' } });
  render(<ContractsPage />);
  expect(await screen.findAllByRole('heading', { name: 'Hợp đồng ủy quyền quản lý xe' })).not.toHaveLength(0);
  expect(screen.getByRole('button', { name: /Hợp đồng thuê xe/ })).toHaveAttribute('aria-pressed', 'false');
  await waitFor(() => expect(getApi).toHaveBeenCalledWith('/contracts/management?view=staff&page=1&limit=10', expect.anything()));
  fireEvent.click(await screen.findByRole('button', { name: 'Rà soát tiếp nhận' }));
  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByText(/Đây không phải phê duyệt nội dung hoặc chữ ký thay Manager/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận đã tiếp nhận' }));
  await waitFor(() => expect(postApi).toHaveBeenCalledWith('/contracts/management/agreement-1/operator-intake?view=staff', {}));
  expect(await within(dialog).findByText(/Operator đã tiếp nhận hồ sơ\. Hợp đồng đang chờ Manager ký/)).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Xác nhận ký hợp đồng' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Hợp đồng thuê xe/ }));
  expect(screen.getByRole('button', { name: /Hợp đồng thuê xe/ })).toHaveAttribute('aria-pressed', 'true');
  await waitFor(() => expect(getApi).toHaveBeenCalledWith('/contracts/rental?view=staff&page=1&limit=10', expect.anything()));
  expect(screen.queryByRole('button', { name: 'Lập / mở hợp đồng' })).not.toBeInTheDocument();
});

test('Operator is told when intake permission has not been granted to the signed-in account', async () => {
  saveSession('operation-token', {
    full_name: 'Operation',
    roles: ['OPERATION_STAFF'],
    permissions: ['operation.contract.read'],
  }, false);
  getApi.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0 } });
  render(<ContractsPage />);
  expect(await screen.findByText(/vẫn có thể xem hợp đồng, nhưng tài khoản chưa được cấp quyền tiếp nhận/)).toHaveAttribute('role', 'status');
  expect(screen.getByRole('button', { name: /Hợp đồng ủy quyền quản lý xe/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Hợp đồng thuê xe/ })).toBeInTheDocument();
});

test.each([
  ['management', 'OWNER'],
  ['rental', 'RENTER'],
])('an unprepared %s record does not show a blank template or print action', async (type, role) => {
  const noDocument = { ...row, type, status: 'pending_signatures', canSign: false, document: null };
  saveSession('party-token', { full_name: 'Party', roles: [role] }, false);
  getApi.mockImplementation(async (path) => path.includes('agreement-1?')
    ? { data: noDocument }
    : { data: [noDocument], pagination: { page: 1, limit: 10, total: 1 } });

  render(<ContractsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xem hợp đồng' }));
  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByRole('heading', { name: 'Manager cần lập nội dung hợp đồng' })).toBeInTheDocument();
  expect(within(dialog).getByText(/Hệ thống sẽ tự điền thông tin xe hoặc booking/)).toBeInTheDocument();
  expect(within(dialog).queryByRole('link', { name: 'Tải file DOCX' })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'In / lưu PDF' })).not.toBeInTheDocument();
  expect(renderAsync).not.toHaveBeenCalled();
  expect(screen.queryByText('Trạng thái chữ ký')).not.toBeInTheDocument();
});

test('Operator embedded contract workspace has exact-code search and no scope selector', async () => {
  saveSession('operation-token', {
    full_name: 'Operation',
    roles: ['OPERATION_STAFF'],
    permissions: ['operation.contract.read'],
  }, false);
  getApi.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0 } });

  render(<ContractsPage embedded />);
  await screen.findAllByRole('heading', { name: 'Hợp đồng ủy quyền quản lý xe' });
  expect(screen.queryByLabelText('Phạm vi')).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Mã hợp đồng' }), { target: { value: 'MGMT-TEST-1' } });
  expect(getApi).not.toHaveBeenCalledWith(expect.stringContaining('q=MGMT-TEST-1'), expect.anything());
  fireEvent.click(screen.getByRole('button', { name: 'Tìm chính xác' }));
  await waitFor(() => expect(getApi).toHaveBeenCalledWith(
    '/contracts/management?view=staff&page=1&limit=10&q=MGMT-TEST-1',
    expect.anything(),
  ));
});

test('Manager sees that platform signing is waiting for Operator intake', async () => {
  saveSession('manager-token', { full_name: 'Manager', roles: ['MANAGER'] }, false);
  const managerRow = { ...row, canSign: false, partySigned: true, partySignedAt: '2026-11-11T01:00:00Z' };
  getApi.mockImplementation(async (path) => path.includes('agreement-1?')
    ? { data: managerRow }
    : { data: [managerRow], pagination: { page: 1, limit: 10, total: 1 } });
  render(<ContractsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xem hợp đồng' }));
  expect(await screen.findByText(/đang chờ Operator xác nhận tiếp nhận trước khi Manager có thể ký/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Xác nhận ký hợp đồng' })).not.toBeInTheDocument();
});
