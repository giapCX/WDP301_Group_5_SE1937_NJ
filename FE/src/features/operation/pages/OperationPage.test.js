import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OperationPage from './OperationPage';
import { getCurrentUser } from '../../auth/session';
import { getOperationDashboard, getOperationResource } from '../api/operationApi';

jest.mock('../../auth/session', () => ({ getCurrentUser: jest.fn() }));
jest.mock('../api/operationApi', () => ({
  createIncident: jest.fn(), decideBooking: jest.fn(), getOperationDashboard: jest.fn(),
  getOperationDetail: jest.fn(), getOperationResource: jest.fn(), overdueAction: jest.fn(),
  getOperationStaff: jest.fn(), reviewListing: jest.fn(), reviewViolation: jest.fn(), updateComplaint: jest.fn(),
  updateDispute: jest.fn(), updateIncident: jest.fn(), updateListing: jest.fn(),
}));

beforeEach(() => {
  window.location.hash = '#/operation';
  getCurrentUser.mockReturnValue({ _id: 'staff-1', full_name: 'Operation Staff', email: 'ops@example.com', roles: ['OPERATION_STAFF'] });
  getOperationDashboard.mockResolvedValue({ data: { metrics: {
    pendingBookings: 3, activeRentals: 4, overdueRentals: 1, openIncidents: 2,
    openViolations: 1, openDisputes: 1, openComplaints: 0,
  } } });
  getOperationResource.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
});

test('shows operation KPIs and navigates to an empty booking queue', async () => {
  render(<OperationPage />);
  expect((await screen.findAllByText('3')).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Về trang XeDi/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /OPERATION CENTER/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /Booking chờ xử lý/ })[1]);
  expect(await screen.findByText('Không tìm thấy hồ sơ phù hợp.')).toBeInTheDocument();
  await waitFor(() => expect(getOperationResource).toHaveBeenCalledWith('bookings', expect.objectContaining({ page: 1 }), expect.anything()));
});

test('blocks users without an operation role', () => {
  getCurrentUser.mockReturnValue({ roles: ['RENTER'] });
  render(<OperationPage />);
  expect(screen.getByRole('heading', { name: 'Cần đăng nhập bằng tài khoản vận hành' })).toBeInTheDocument();
});
