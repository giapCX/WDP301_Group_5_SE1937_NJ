import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OperationPage from './OperationPage';
import { getCurrentUser } from '../../auth/session';
import { getGarageStaff, getOperationDashboard, getOperationResource, screenVehicle } from '../api/operationApi';

jest.mock('../../auth/session', () => ({ getCurrentUser: jest.fn() }));
jest.mock('../api/operationApi', () => ({
  createIncident: jest.fn(), decideBooking: jest.fn(), getOperationDashboard: jest.fn(),
  getOperationDetail: jest.fn(), getOperationResource: jest.fn(), overdueAction: jest.fn(),
  getOperationStaff: jest.fn(), getGarageStaff: jest.fn(), screenVehicle: jest.fn(),
  reviewListing: jest.fn(), reviewViolation: jest.fn(), updateComplaint: jest.fn(),
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
  await act(async () => {
    render(<OperationPage />);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /Booking chờ xử lý/ })[1]);
  expect(await screen.findByText('Không tìm thấy hồ sơ phù hợp.')).toBeInTheDocument();
  await waitFor(() => expect(getOperationResource).toHaveBeenCalledWith('bookings', expect.objectContaining({ page: 1 }), expect.anything()));
});

test('blocks users without an operation role', () => {
  getCurrentUser.mockReturnValue({ roles: ['RENTER'] });
  render(<OperationPage />);
  expect(screen.getByRole('heading', { name: 'Cần đăng nhập bằng tài khoản vận hành' })).toBeInTheDocument();
});

test('assigns an onboarding inspection to an eligible garage staff member', async () => {
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  getOperationResource.mockImplementation((resource) => Promise.resolve({
    data: resource === 'vehicles' ? [{
      id: 'vehicle-1', brand: 'Toyota', model: 'Vios', licensePlate: 'ABC-123',
      onboardingStatus: 'submitted', inspection: null,
    }] : [],
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
  }));
  getGarageStaff.mockResolvedValue({ data: [{ id: 'garage-1', name: 'Garage Staff', email: 'garage@example.com' }] });
  screenVehicle.mockResolvedValue({ data: {} });
  const prompt = jest.spyOn(window, 'prompt')
    .mockReturnValueOnce('garage@example.com')
    .mockReturnValueOnce(scheduledFor)
    .mockReturnValueOnce('Kiểm định tại gara');

  await act(async () => {
    render(<OperationPage />);
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: 'Hồ sơ xe & kiểm định' })[0]);
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(getOperationResource).toHaveBeenCalledWith('vehicles', expect.anything(), expect.anything()));
  fireEvent.click(await screen.findByRole('button', { name: 'Hẹn kiểm định' }));

  await waitFor(() => expect(screenVehicle).toHaveBeenCalledWith('vehicle-1', {
    action: 'schedule_inspection',
    garageStaffId: 'garage-1',
    scheduledFor,
    note: 'Kiểm định tại gara',
  }));
  prompt.mockRestore();
});
