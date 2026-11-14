import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import RenterContracts from './RenterContracts';
import { getApi, postApi } from '../../../services/httpClient';
import { saveSession } from '../../auth/session';
jest.mock('../../../services/httpClient', () => ({ getApi: jest.fn(), postApi: jest.fn() }));
const contract = {
  id: 'rental-1', type: 'rental', number: 'RENT-TEST', bookingId: 'booking-1', bookingCode: 'BK-TEST',
  vehicle: 'Toyota Vios · 30A-12345', status: 'pending_signatures', canSign: true,
  startDate: '2026-12-01T02:00:00Z', endDate: '2026-12-03T02:00:00Z', rentalFee: 1400000, depositAmount: 3000000,
  document: { title: 'Hợp đồng thuê xe tự lái', version: 'v1', hash: 'frozen-contract', prepared_at: '2026-11-14T01:00:00Z', facts: [{ label: 'Khách thuê', value: 'Khách Kiểm Thử' }, { label: 'Tiền cọc', value: '3.000.000 VND' }], clauses: ['Điều khoản đã lưu trong hợp đồng.'] },
};
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); getApi.mockReset(); postApi.mockReset();
  saveSession('renter-token', { full_name: 'Khách Kiểm Thử', roles: ['RENTER'] }, false);
  getApi.mockImplementation(async path => path.includes('/rental/rental-1?') ? { data: contract } : { data: [contract], pagination: { page: 1, total: 1 } });
});
afterEach(() => { localStorage.clear(); sessionStorage.clear(); });
test('renter reads the saved contract and signs the exact reviewed version', async () => {
  postApi.mockResolvedValue({ data: { ...contract, canSign: false, partySignedAt: '2026-11-14T04:00:00Z', partyName: 'Khách Kiểm Thử' } });
  render(<RenterContracts />);
  fireEvent.click(await screen.findByRole('button', { name: 'Đọc và ký' }));
  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByRole('article', { name: 'Bản hợp đồng thuê xe' })).toBeInTheDocument();
  expect(within(dialog).getByText('Điều khoản đã lưu trong hợp đồng.')).toBeInTheDocument();
  expect(within(dialog).getByText('3.000.000 VND')).toBeInTheDocument();
  const sign = within(dialog).getByRole('button', { name: 'Xác nhận ký hợp đồng' });
  expect(sign).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(sign);
  await waitFor(() => expect(postApi).toHaveBeenCalledWith('/contracts/rental/rental-1/sign?view=party', { signatureName: 'Khách Kiểm Thử', acceptedTerms: true, documentHash: 'frozen-contract' }));
  expect(await within(dialog).findByText('Đã xác nhận điện tử')).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Xác nhận ký hợp đồng' })).not.toBeInTheDocument();
});
test('renter sees an empty list without a signing action', async () => {
  getApi.mockResolvedValue({ data: [], pagination: { page: 1, total: 0 } });
  render(<RenterContracts />);
  expect(await screen.findByText('Chưa có hợp đồng thuê xe')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Đọc và ký' })).not.toBeInTheDocument();
});
test('loading failure is explicit and can be retried', async () => {
  getApi.mockRejectedValueOnce(new Error('Không tải được dữ liệu hợp đồng.'));
  render(<RenterContracts />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được dữ liệu hợp đồng.');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('button', { name: 'Đọc và ký' })).toBeInTheDocument();
});
