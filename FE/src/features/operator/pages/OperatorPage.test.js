import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { saveSession } from '../../auth/session';
import OperatorPage from './OperatorPage';
import {
  createOperatorIncident,
  getOperatorDashboard,
  getOperatorGarageStaff,
  getOperatorIncident,
  getOperatorIncidents,
  getOperatorInspectionWorkflow,
  getOperatorVehicles,
  getOperatorVehicle,
  precheckOperatorVehicleInspection,
  scheduleOperatorVehicleInspection,
  updateOperatorIncident,
  updateOperatorVehicleInspectionSchedule,
  updateOperatorVehicleStatus,
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
  getOperatorInspectionWorkflow: jest.fn(),
  getOperatorGarageStaff: jest.fn(),
  getOperatorVehicles: jest.fn(),
  getOperatorVehicle: jest.fn(),
  getOperatorVehicleDocument: jest.fn(),
  precheckOperatorVehicleInspection: jest.fn(),
  submitOperatorIncident: jest.fn(),
  updateOperatorIncident: jest.fn(),
  scheduleOperatorVehicleInspection: jest.fn(),
  updateOperatorVehicleInspectionSchedule: jest.fn(),
  updateOperatorVehicleStatus: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
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
      'operation.vehicle.inspection.schedule',
      'operation.vehicle.inspection.review',
      'operation.incident.read',
      'operation.incident.create',
      'operation.incident.update',
      'operation.incident.evidence.attach',
      'operation.incident.submit',
    ],
  }, false);
  getOperatorDashboard.mockResolvedValue({ data: { metrics: { activeVehicles: 2, expiringContracts: 3, incidentsInProgress: 1, vehiclesAwaitingInspection: 4 } } });
  getOperatorVehicles.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0 } });
  getOperatorIncidents.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0 } });
  getOperatorInspectionWorkflow.mockResolvedValue({
    data: { scheduleRequests: [], garageReports: [] },
    pagination: {
      scheduleRequests: { page: 1, limit: 10, total: 0 },
      garageReports: { page: 1, limit: 10, total: 0 },
    },
  });
  getOperatorGarageStaff.mockResolvedValue({ data: [{ id: 'garage-1', name: 'Garage Staff', email: 'garage@example.com' }] });
  getOperatorVehicle.mockResolvedValue({ data: {
    id: 'vehicle-1',
    brand: 'Toyota',
    model: 'Vios',
    licensePlate: 'TEST-1',
    physicalStatus: 'with_owner',
    onboardingStatus: 'approved',
    statusHistory: [],
    documents: {},
  } });
  createOperatorIncident.mockResolvedValue({});
  updateOperatorIncident.mockResolvedValue({});
  updateOperatorVehicleStatus.mockResolvedValue({});
  scheduleOperatorVehicleInspection.mockResolvedValue({});
  updateOperatorVehicleInspectionSchedule.mockResolvedValue({});
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test('renders the Operator Staff menus in the required order', async () => {
  render(<OperatorPage />);
  const nav = screen.getByRole('navigation', { name: 'Điều hướng Operator Staff' });
  expect(within(nav).getAllByRole('button').map((button) => button.textContent.trim())).toEqual([
    'Tổng quan',
    'Hợp đồng xe',
    'Thông tin xe',
    'Lịch kiểm tra xe',
    'Thông tin pháp lý sự cố của xe',
  ]);
  expect(await screen.findByText('Xe đang chạy')).toBeInTheDocument();
  expect(screen.getByText('Hồ sơ xe chờ phân công kiểm định')).toBeInTheDocument();

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

test('vehicle status updates require an explicit reason and use the permitted transition', async () => {
  getOperatorVehicles.mockResolvedValueOnce({
    data: [{ id: 'vehicle-1', licensePlate: 'TEST-1', brand: 'Toyota', model: 'Vios', physicalStatus: 'with_owner' }],
    pagination: { page: 1, limit: 10, total: 1 },
  });
  render(<OperatorPage initialSection="vehicles" />);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng Operator Staff' }))
    .getByRole('button', { name: 'Thông tin xe' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }));
  fireEvent.change(await screen.findByLabelText('Trạng thái mới'), { target: { value: 'maintenance' } });
  fireEvent.change(screen.getByLabelText('Lý do cập nhật'), { target: { value: 'Chuyển xe đi bảo dưỡng.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu trạng thái' }));
  await waitFor(() => expect(updateOperatorVehicleStatus).toHaveBeenCalledWith('vehicle-1', {
    status: 'maintenance',
    note: 'Chuyển xe đi bảo dưỡng.',
  }));
});

test('draft inspection can be rescheduled with its current version', async () => {
  getOperatorVehicles.mockResolvedValueOnce({
    data: [{ id: 'vehicle-1', licensePlate: 'TEST-1', brand: 'Toyota', model: 'Vios' }],
    pagination: { page: 1, limit: 10, total: 1 },
  });
  getOperatorVehicle.mockResolvedValue({
    data: {
      id: 'vehicle-1',
      brand: 'Toyota',
      model: 'Vios',
      licensePlate: 'TEST-1',
      physicalStatus: 'with_owner',
      onboardingStatus: 'submitted',
      statusHistory: [],
      documents: {},
      inspection: {
        id: 'inspection-1',
        status: 'draft',
        scheduleState: 'upcoming',
        garageStaffId: 'garage-1',
        scheduledFor: '2030-01-02T03:04:00.000Z',
        scheduleNote: 'Initial schedule',
        version: 3,
        garageStaff: { full_name: 'Garage Staff', email: 'garage@example.com' },
      },
    },
  });
  render(<OperatorPage initialSection="vehicles" />);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng Operator Staff' }))
    .getByRole('button', { name: 'Thông tin xe' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Đổi lịch / người phụ trách' }));
  fireEvent.change(await screen.findByLabelText('Thời gian kiểm định'), { target: { value: '2030-01-03T04:05' } });
  fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Đã xác nhận lịch mới.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi lịch' }));
  await waitFor(() => expect(updateOperatorVehicleInspectionSchedule).toHaveBeenCalledWith('vehicle-1', {
    garageStaffId: 'garage-1',
    scheduledFor: new Date('2030-01-03T04:05').toISOString(),
    note: 'Đã xác nhận lịch mới.',
    version: 3,
  }));
});

test('incident form searches vehicles by text and omits booking and coordinates', async () => {
  getOperatorVehicles.mockResolvedValue({
    data: [{ id: 'vehicle-1', licensePlate: 'TEST-1', brand: 'Toyota', model: 'Vios' }],
    pagination: { page: 1, limit: 10, total: 1 },
  });
  render(<OperatorPage initialSection="incidents" />);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng Operator Staff' }))
    .getByRole('button', { name: 'Thông tin pháp lý sự cố của xe' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận sự cố' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Xe liên quan' }), { target: { value: 'TEST-1' } });
  fireEvent.click(await screen.findByRole('option', { name: 'TEST-1 · Toyota Vios' }));
  expect(screen.queryByLabelText('Booking liên quan')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Vĩ độ (không bắt buộc)')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Kinh độ (không bắt buộc)')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nhóm sự cố chi tiết'), { target: { value: 'Trầy xước' } });
  fireEvent.change(screen.getByLabelText('Mức độ'), { target: { value: 'high' } });
  fireEvent.change(screen.getByLabelText('Số km tại thời điểm ghi nhận'), { target: { value: '12500' } });
  fireEvent.change(screen.getByLabelText('Mô tả sự việc'), { target: { value: 'Ghi nhận hư hỏng xe.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  expect(createOperatorIncident).not.toHaveBeenCalled();
  expect(screen.getByText('Hãy xác nhận xe có bị cơ quan chức năng tạm giữ hay không.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Cơ quan chức năng có tạm giữ xe không?'), { target: { value: 'false' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  await waitFor(() => expect(createOperatorIncident).toHaveBeenCalledWith({
    vehicleId: 'vehicle-1',
    caseType: 'vehicle_damage',
    description: 'Ghi nhận hư hỏng xe.',
    incidentType: 'Trầy xước',
    odometerKm: 12500,
    severity: 'high',
    vehicleSeized: false,
  }));
});

test('incident update form hides booking and coordinate details', async () => {
  getOperatorIncidents.mockResolvedValue({
    data: [{
      id: 'incident-1',
      caseNumber: 'CASE-1',
      status: 'need_more_information',
      description: 'Cần bổ sung hồ sơ.',
      bookingId: 'booking-1',
      location: { latitude: 10.77, longitude: 106.69 },
      vehicle: { id: 'vehicle-1', licensePlate: 'TEST-1' },
    }],
    pagination: { page: 1, limit: 10, total: 1 },
  });

  getOperatorIncident.mockResolvedValue({ data: {
    id: 'incident-1',
    caseNumber: 'CASE-1',
    status: 'need_more_information',
    description: 'Cần bổ sung hồ sơ.',
    bookingId: 'booking-1',
    location: { latitude: 10.77, longitude: 106.69 },
    vehicle: { id: 'vehicle-1', licensePlate: 'TEST-1' },
  } });
  render(<OperatorPage initialSection="incidents" />);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng Operator Staff' }))
    .getByRole('button', { name: 'Thông tin pháp lý sự cố của xe' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }));
  expect(await screen.findByRole('heading', { name: 'CASE-1' })).toBeInTheDocument();
  expect(screen.queryByText(/Booking liên quan/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Vĩ độ')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Kinh độ')).not.toBeInTheDocument();
});

test('inspection navigation shows Owner schedule requests and lets Operator assign Garage Staff', async () => {
  getOperatorInspectionWorkflow.mockResolvedValue({
    data: {
      scheduleRequests: [{
        id: 'vehicle-1',
        brand: 'Toyota',
        model: 'Vios',
        licensePlate: 'TEST-1',
        owner: { full_name: 'Chủ xe thử nghiệm', email: 'owner@example.com' },
        inspectionScheduleRequest: {
          status: 'pending',
          requested_for: new Date(Date.now() + 3600000).toISOString(),
          note: 'Xin kiểm tra xe tại gara.',
        },
      }],
      garageReports: [],
    },
    pagination: { scheduleRequests: { page: 1, limit: 10, total: 1 }, garageReports: { page: 1, limit: 10, total: 0 } },
  });
  getOperatorVehicle.mockResolvedValue({ data: {
    id: 'vehicle-1',
    brand: 'Toyota',
    model: 'Vios',
    licensePlate: 'TEST-1',
    physicalStatus: 'with_owner',
    onboardingStatus: 'submitted',
    inspectionScheduleRequest: {
      status: 'pending',
      requested_for: new Date(Date.now() + 3600000).toISOString(),
      note: 'Xin kiểm tra xe tại gara.',
    },
    statusHistory: [],
    documents: {},
  } });
  render(<OperatorPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lịch kiểm tra xe' }));
  expect(await screen.findByText('Yêu cầu lịch từ Chủ xe')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận lịch & phân công' }));
  const staff = await screen.findByLabelText('Nhân viên Garage');
  fireEvent.change(staff, { target: { value: 'garage-1' } });
  fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Đã xác nhận lịch với Chủ xe.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch kiểm định' }));
  await waitFor(() => expect(scheduleOperatorVehicleInspection).toHaveBeenCalledWith('vehicle-1', expect.objectContaining({
    garageStaffId: 'garage-1',
    note: 'Đã xác nhận lịch với Chủ xe.',
  })));
});

test('inspection queue exposes Garage report details before Operator precheck', async () => {
  getOperatorInspectionWorkflow.mockResolvedValue({
    data: {
      scheduleRequests: [],
      garageReports: [{
        id: 'inspection-1',
        recommendation: 'pass',
        submittedAt: new Date().toISOString(),
        ownerReview: { status: 'accepted' },
        vehicle: { id: 'vehicle-1', brand: 'Toyota', model: 'Vios', licensePlate: 'TEST-1' },
      }],
    },
    pagination: { scheduleRequests: { page: 1, limit: 10, total: 0 }, garageReports: { page: 1, limit: 10, total: 1 } },
  });
  getOperatorVehicle.mockResolvedValue({ data: {
    id: 'vehicle-1',
    brand: 'Toyota',
    model: 'Vios',
    licensePlate: 'TEST-1',
    physicalStatus: 'with_owner',
    onboardingStatus: 'submitted',
    inspection: { id: 'inspection-1', status: 'pending', operatorReview: null },
    inspectionReport: {
      recommendation: 'pass',
      conditionReport: {
        odometer_km: 12500,
        fuel_level_pct: 70,
        checklist: [{ key: 'identity', result: 'pass', note: 'Đã đối chiếu giấy tờ Chủ xe.' }],
      },
      ownerReview: { status: 'accepted' },
    },
    statusHistory: [],
    documents: {},
  } });
  precheckOperatorVehicleInspection.mockResolvedValue({});
  render(<OperatorPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lịch kiểm tra xe' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Xem biên bản' }));
  expect(await screen.findByText(/Đã đối chiếu giấy tờ Chủ xe\./)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận biên bản đầy đủ, chuyển Manager' }));
  await waitFor(() => expect(precheckOperatorVehicleInspection).toHaveBeenCalledWith('inspection-1', {
    note: 'Đã kiểm tra thông tin biên bản Garage.',
  }));
});

test('empty vehicle search results do not show a no-match message', async () => {
  render(<OperatorPage initialSection="incidents" />);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng Operator Staff' }))
    .getByRole('button', { name: 'Thông tin pháp lý sự cố của xe' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận sự cố' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Xe liên quan' }), { target: { value: 'NOTFOUND' } });
  await waitFor(() => expect(getOperatorVehicles).toHaveBeenCalledWith(
    expect.objectContaining({ page: 1, limit: 10, q: 'NOTFOUND' }),
    expect.any(Object),
  ));
  await waitFor(() => expect(screen.queryByText('Đang tìm xe…')).not.toBeInTheDocument());
  expect(screen.queryByText('Không tìm thấy xe phù hợp.')).not.toBeInTheDocument();
});
