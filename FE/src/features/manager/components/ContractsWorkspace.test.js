import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ContractsWorkspace from './ContractsWorkspace';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';

jest.mock('../hooks/useManagerActions');
jest.mock('../hooks/useManagerCollection');
jest.mock('../../contracts/ContractsPage', () => () => null);

test('Manager submits a changed nested term while preserving the rest of the contract', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const terms = { booking_management: true, mileage_policy: { included_km_per_day: 100, flags: ['existing'] } };
  const updateContract = jest.fn().mockResolvedValue({});
  useManagerActions.mockReturnValue({ updateContract });
  useManagerCollection.mockReturnValue({
    data: [{ id: 'contract-id', number: 'MGMT-001', status: 'active', terms }],
    refresh: jest.fn(),
    paging: { total: 0 },
  });
  render(<ContractsWorkspace onNotice={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xem hồ sơ và phụ lục' }));
  fireEvent.click(screen.getByRole('button', { name: 'Đề nghị sửa đổi' }));
  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Cập nhật giới hạn quãng đường' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: /Số km bao gồm mỗi ngày/ }), { target: { value: '120' } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đề nghị sửa đổi' }));
  await waitFor(() => expect(updateContract).toHaveBeenCalledWith('management', 'contract-id', {
    action: 'amend',
    reason: 'Cập nhật giới hạn quãng đường',
    proposedTerms: { booking_management: true, mileage_policy: { included_km_per_day: 120, flags: ['existing'] } },
  }));
  expect(terms.mileage_policy.included_km_per_day).toBe(100);
});
