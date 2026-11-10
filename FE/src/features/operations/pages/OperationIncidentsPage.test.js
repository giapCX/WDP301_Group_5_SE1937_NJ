import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OperationIncidentsPage from './OperationIncidentsPage';
import { getApi, postApi } from '../../../services/httpClient';

jest.mock('../../../services/httpClient', () => ({ getApi: jest.fn(), postApi: jest.fn() }));
jest.mock('../../garage/components/GaragePhotoPreview', () => () => null);

test('Operation submits an evidence-based proposal with an explicit customer response', async () => {
  const incident = { _id: 'incident-id', case_number: 'SC-1', description: 'Garage reported return damage', booking_id: 'booking', status: 'reported' };
  getApi.mockResolvedValueOnce({ data: [incident] }).mockResolvedValue({ data: [{ ...incident, investigation: { review_status: 'proposed' } }] });
  postApi.mockResolvedValue({});
  render(<OperationIncidentsPage />);
  await screen.findByText('SC-1');
  expect(screen.getByLabelText('Phản hồi thực tế của khách')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Số tiền đề xuất (VND)'), { target: { value: '80' } });
  fireEvent.change(screen.getByLabelText('Căn cứ điều tra, so sánh hiện trạng và chi phí'), { target: { value: 'Before and after evidence compared' } });
  fireEvent.change(screen.getByLabelText('Phản hồi thực tế của khách'), { target: { value: 'not_received' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Gửi đề xuất cho Manager' }).closest('form'));
  await waitFor(() => expect(postApi).toHaveBeenCalledWith('/operations/incidents/incident-id/compensation-proposal', { amount: 80, evidenceBasis: 'Before and after evidence compared', renterResponse: 'not_received' }));
  expect(await screen.findByText('Đã gửi đề xuất. Chờ Manager ra quyết định.')).toBeInTheDocument();
});
