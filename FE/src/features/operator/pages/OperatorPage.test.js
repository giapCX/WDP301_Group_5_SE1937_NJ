import { fireEvent, render, screen, within } from '@testing-library/react';
import { saveSession } from '../../auth/session';
import OperatorPage from './OperatorPage';
import {
  getOperatorDashboard,
  getOperatorIncidents,
  getOperatorVehicles,
} from '../api/operatorApi';

jest.mock('../../contracts/ContractsPage', () => function MockContractsPage() {
  return <div>Contract list</div>;
});
jest.mock('../api/operatorApi', () => ({
  attachOperatorEvidence: jest.fn(),
  createOperatorIncident: jest.fn(),
  getOperatorDashboard: jest.fn(),
  getOperatorEvidence: jest.fn(),
  getOperatorIncident: jest.fn(),
  getOperatorIncidents: jest.fn(),
  getOperatorVehicles: jest.fn(),
  getOperatorVehicle: jest.fn(),
  getOperatorVehicleDocument: jest.fn(),
  submitOperatorIncident: jest.fn(),
  updateOperatorIncident: jest.fn(),
  updateOperatorVehicleStatus: jest.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = '#/operator';
  saveSession('operator-token', {
    full_name: 'Operator Staff',
    email: 'operator@example.com',
    roles: ['OPERATION_STAFF'],
    permissions: [
      'operation.dashboard.read',
      'operation.contract.read',
      'operation.vehicle.read',
      'operation.vehicle.status.update',
      'operation.incident.read',
      'operation.incident.create',
      'operation.incident.update',
      'operation.incident.evidence.attach',
      'operation.incident.submit',
    ],
  }, false);
  getOperatorDashboard.mockResolvedValue({ data: { metrics: { activeVehicles: 2, expiringContracts: 3, incidentsInProgress: 1 } } });
  getOperatorVehicles.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0 } });
  getOperatorIncidents.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0 } });
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test('renders the four Operator Staff menus in the required order', async () => {
  render(<OperatorPage />);
  const nav = screen.getByRole('navigation', { name: 'Điều hướng Operator Staff' });
  expect(within(nav).getAllByRole('button').map((button) => button.textContent.trim())).toEqual([
    'Tổng quan',
    'Hợp đồng xe',
    'Thông tin xe',
    'Thông tin pháp lý sự cố của xe',
  ]);
  expect(await screen.findByText('Xe đang chạy')).toBeInTheDocument();

  fireEvent.click(within(nav).getByRole('button', { name: 'Hợp đồng xe' }));
  expect(await screen.findByText('Contract list')).toBeInTheDocument();
  fireEvent.click(within(nav).getByRole('button', { name: 'Thông tin xe' }));
  expect(await screen.findByText('Không có xe phù hợp.')).toBeInTheDocument();
  fireEvent.click(within(nav).getByRole('button', { name: 'Thông tin pháp lý sự cố của xe' }));
  expect(await screen.findByText('Chưa có hồ sơ sự cố.')).toBeInTheDocument();
});

test('direct navigation to an unpermitted menu displays an access denial', () => {
  window.location.hash = '#/operator/vehicles';
  saveSession('operator-token', {
    full_name: 'Operator Staff',
    roles: ['OPERATION_STAFF'],
    permissions: ['operation.dashboard.read'],
  }, false);
  render(<OperatorPage />);
  expect(screen.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument();
});
