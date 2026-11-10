import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VehicleApprovalsWorkspace from './VehicleApprovalsWorkspace';
import useManagerCollection from '../hooks/useManagerCollection';
import useManagerActions from '../hooks/useManagerActions';

jest.mock('../hooks/useManagerCollection');
jest.mock('../hooks/useManagerActions');
jest.mock('../../garage/components/GaragePhotoPreview', () => ({ photo }) => <button type="button">Xem minh chứng {photo.name}</button>);

const vehicle = {
  id: 'vehicle-id', brand: 'Toyota', model: 'Vios', licensePlate: 'TEST-001', status: 'submitted',
  inspection: { id: 'inspection-id', version: 2, status: 'pending', recommendation: 'pass', conditionReport: { odometer_km: 12345, fuel_level_pct: 70, exterior: 'good', interior: 'good', engine: 'good', tires: 'good', note: 'Report submitted by Garage', photo_keys: ['garage-photos/staff/car.jpg'] } },
};
let reviewVehicle, refresh;
beforeEach(() => {
  reviewVehicle = jest.fn().mockResolvedValue({});
  refresh = jest.fn();
  useManagerActions.mockReturnValue({ reviewVehicle });
  useManagerCollection.mockReturnValue({ data: [vehicle], loading: false, error: '', refresh });
  jest.spyOn(window, 'prompt').mockReturnValue('Reviewed complete report');
});
afterEach(() => jest.restoreAllMocks());

test('Manager can review submitted evidence and approve a pending passing report with its exact version', async () => {
  render(<VehicleApprovalsWorkspace onNotice={jest.fn()} />);
  expect(screen.getByText('12345 km')).toBeInTheDocument();
  expect(screen.getByText('70%')).toBeInTheDocument();
  expect(screen.getByText('Report submitted by Garage')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem minh chứng car.jpg' })).toBeInTheDocument();
  const approve = screen.getByRole('button', { name: 'Duyệt xe và kiểm định' });
  expect(approve).toBeEnabled();
  fireEvent.click(approve);
  await waitFor(() => expect(reviewVehicle).toHaveBeenCalledWith('vehicle-id', { action: 'approve', note: 'Reviewed complete report', inspectionId: 'inspection-id', inspectionVersion: 2 }));
  expect(refresh).toHaveBeenCalled();
});

test('a Garage draft cannot be decided and a failed recommendation cannot be approved', () => {
  useManagerCollection.mockReturnValue({ data: [{ ...vehicle, inspection: { ...vehicle.inspection, status: 'draft' } }], loading: false, refresh });
  const { rerender } = render(<VehicleApprovalsWorkspace onNotice={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Duyệt xe và kiểm định' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Từ chối hồ sơ' })).toBeDisabled();
  useManagerCollection.mockReturnValue({ data: [{ ...vehicle, inspection: { ...vehicle.inspection, recommendation: 'fail' } }], loading: false, refresh });
  rerender(<VehicleApprovalsWorkspace onNotice={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Duyệt xe và kiểm định' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Yêu cầu bổ sung / kiểm định lại' })).toBeEnabled();
});
