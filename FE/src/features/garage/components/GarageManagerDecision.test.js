import { render, screen, within } from '@testing-library/react';
import GarageManagerDecision from './GarageManagerDecision';
import GarageTaskTable from './GarageTaskTable';
import GarageReportDialog from './GarageReportDialog';

const task = { id: 'inspection:vehicle', kind: 'inspection', vehicle: 'Test vehicle', plate: 'TEST-001', status: 'rejected', vehicleReviewStatus: 'rejected', vehicleReviewNote: 'Giấy đăng ký xe bị mờ, cần đối chiếu lại.', readOnly: true, scheduled: false, blockers: [], requirements: {} };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

test('the Garage list displays the reason even when the application has no inspection record', () => {
  render(<GarageTaskTable tasks={[task]} onOpen={jest.fn()} />);
  expect(screen.getByText('Lý do từ chối hồ sơ xe:')).toBeInTheDocument();
  expect(screen.getByText(task.vehicleReviewNote)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem inspection:vehicle' })).toHaveTextContent('Xem hồ sơ');
});

test('opening a rejected application shows its reason without an editable report form', () => {
  render(<GarageReportDialog task={task} onClose={jest.fn()} onSave={jest.fn()} />);
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(task.vehicleReviewNote)).toBeInTheDocument();
  expect(within(dialog).getByText('Hồ sơ đã bị từ chối trước khi có biên bản kiểm định.')).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Gửi đề xuất kiểm định' })).not.toBeInTheDocument();
});

test('inspection decisions and later vehicle rejection notes stay distinct', () => {
  const { rerender } = render(<GarageManagerDecision task={{ ...task, status: 'approved', decisionReason: 'Đã duyệt kiểm định trước đây.' }} />);
  expect(screen.getByText('Đã duyệt kiểm định trước đây.')).toBeInTheDocument();
  expect(screen.getByText(task.vehicleReviewNote)).toBeInTheDocument();
  rerender(<GarageManagerDecision task={{ ...task, decisionReason: task.vehicleReviewNote }} />);
  expect(screen.getAllByText(task.vehicleReviewNote)).toHaveLength(1);
});
