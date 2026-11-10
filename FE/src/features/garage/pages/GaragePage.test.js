import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import GaragePage from './GaragePage';
import { saveSession } from '../../auth/session';

const vehicleId = '030000000000000000000001';
const recordId = '040000000000000000000001';
let workspace, failLoad, failConfirm, failIncident;
const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  saveSession('garage-jwt', { full_name: 'Garage employee' }, false);
  window.history.replaceState(null, '', '/garage#inspections');
  workspace = {
    tasks: [{ id: `inspection:${vehicleId}`, kind: 'inspection', vehicleId, status: 'pending', vehicle: 'Xe từ database', plate: 'TEST-001', contact: 'Chủ xe', schedule: '2026-11-10T09:00:00+07:00', scheduled: false, location: 'Gara', bay: 'A', reference: 'TEST', odometer: 10000, fuel: 70, requirements: {}, blockers: [], readOnly: false }],
    incidents: [], history: [], vehicles: [{ id: vehicleId, vehicle: 'Xe từ database', plate: 'TEST-001' }],
    permissions: ['vehicle.inspect', 'vehicle.intake', 'handover.record', 'case.report'],
  };
  failLoad = false; failConfirm = false; failIncident = false;
  global.fetch = jest.fn(async (url, options = {}) => {
    if (url === '/api/garage/workspace') {
      if (failLoad) return json({ error: { message: 'Không tải được dữ liệu thật' } }, 503);
      return json({ data: JSON.parse(JSON.stringify(workspace)) });
    }
    const body = JSON.parse(options.body || '{}');
    if (url === '/api/garage/inspections') {
      workspace.tasks[0] = { ...workspace.tasks[0], recordId, version: 0, status: 'draft' };
      return json({ data: { _id: recordId, version: 0 } }, 201);
    }
    if (url === `/api/garage/inspections/${recordId}`) {
      workspace.tasks[0].version = body.version + 1;
      return json({ data: { _id: recordId, version: body.version + 1 } });
    }
    if (url === `/api/garage/inspections/${recordId}/submit`) {
      if (failConfirm) return json({ error: { message: 'Server chưa gửi được đề xuất' } }, 503);
      workspace.tasks[0] = { ...workspace.tasks[0], status: 'submitted', readOnly: true, version: body.version + 1 };
      return json({ data: { _id: recordId, version: body.version + 1 } });
    }
    if (url === '/api/garage/incidents') {
      if (failIncident) return json({ error: { message: 'Chưa gửi được sự cố' } }, 503);
      workspace.incidents = [{ id: 'SC-LIVE', recordId: 'incident-id', vehicle: 'Xe từ database', plate: 'TEST-001', description: body.description, time: '2026-11-10T10:00:00Z', severity: body.severity, status: 'reported', photos: [] }];
      return json({ data: { _id: 'incident-id' } }, 201);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
});
afterEach(() => { delete global.fetch; window.history.replaceState(null, '', '/'); });
async function openReport() {
  const open = await screen.findByRole('button', { name: `Xem inspection:${vehicleId}` });
  fireEvent.click(open);
  return screen.getByRole('dialog');
}
function fillReport(dialog, recommendation = 'Đề xuất đạt') {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tất cả bình thường' }));
  fireEvent.click(within(dialog).getByLabelText(recommendation));
  fireEvent.change(within(dialog).getByLabelText('Ghi chú tình trạng'), { target: { value: 'Đã kiểm tra hiện trạng xe thực tế.' } });
}

test('loads actual workspace using login JWT and never substitutes a saved demo on failure', async () => {
  localStorage.setItem('xedi.garage.preview.v1', JSON.stringify({ tasks: [{ vehicle: 'Fake old vehicle' }] }));
  failLoad = true;
  render(<GaragePage user={{ full_name: 'Garage employee' }} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được dữ liệu thật');
  expect(screen.queryByText('Fake old vehicle')).not.toBeInTheDocument();
  failLoad = false;
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Xe từ database')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith('/api/garage/workspace', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer garage-jwt' }) }));
});

test('saves a real inspection draft and retains it when the page loads again', async () => {
  const view = render(<GaragePage />);
  const dialog = await openReport();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu bản nháp' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(global.fetch).toHaveBeenCalledWith('/api/garage/inspections', expect.objectContaining({ method: 'POST', body: expect.stringContaining(`"vehicleId":"${vehicleId}"`) }));
  expect(localStorage.getItem('xedi.garage.preview.v1')).toBeNull();
  view.unmount(); render(<GaragePage />);
  await screen.findByText('Bản nháp', { selector: '.gs-status' });
});

test('maps inspection recommendation and waits for submit to succeed before showing success', async () => {
  failConfirm = true;
  render(<GaragePage />);
  let dialog = await openReport();
  fillReport(dialog, 'Yêu cầu bổ sung');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi đề xuất kiểm định' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Server chưa gửi được đề xuất');
  expect(screen.queryByText('Đã gửi đề xuất kiểm định cho Manager.')).not.toBeInTheDocument();
  const creation = global.fetch.mock.calls.find(([url]) => url === '/api/garage/inspections');
  expect(JSON.parse(creation[1].body).recommendation).toBe('requires_repair');
  failConfirm = false;
  dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi đề xuất kiểm định' }));
  expect(await screen.findByText('Đã gửi đề xuất kiểm định cho Manager.')).toBeInTheDocument();
  expect(global.fetch.mock.calls.filter(([url]) => url === '/api/garage/inspections')).toHaveLength(1);
  expect(global.fetch).toHaveBeenCalledWith(`/api/garage/inspections/${recordId}`, expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"version":0') }));
});

test('shows backend blockers and prevents final submission while still allowing drafts', async () => {
  workspace.tasks[0].blockers = ['Chưa có phê duyệt kiểm định'];
  render(<GaragePage />);
  const dialog = await openReport();
  expect(within(dialog).getByText('Chưa có phê duyệt kiểm định')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Gửi đề xuất kiểm định' })).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: 'Lưu bản nháp' })).toBeEnabled();
});

test('explicit reload replaces retry checkpoints with the latest server version', async () => {
  failConfirm = true;
  render(<GaragePage />);
  let dialog = await openReport();
  fillReport(dialog);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi đề xuất kiểm định' }));
  await screen.findByRole('alert');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đóng', exact: true }));
  workspace.tasks[0].version = 7;
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
  dialog = await openReport();
  fillReport(dialog);
  failConfirm = false;
  fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi đề xuất kiểm định' }));
  await screen.findByText('Đã gửi đề xuất kiểm định cho Manager.');
  const patch = global.fetch.mock.calls.find(([url]) => url === `/api/garage/inspections/${recordId}`);
  expect(JSON.parse(patch[1].body).version).toBe(7);
});

test('another employee draft is view-only and has no write controls', async () => {
  workspace.tasks[0].status = 'draft';
  workspace.tasks[0].readOnly = true;
  render(<GaragePage />);
  const dialog = await openReport();
  expect(within(dialog).queryByRole('button', { name: 'Lưu bản nháp' })).not.toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Đóng biên bản' })).toBeInTheDocument();
});

test('incident submission uses real vehicle IDs, retries the same request ID and displays server status', async () => {
  window.history.replaceState(null, '', '/garage#incidents');
  render(<GaragePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo báo cáo sự cố', exact: true }));
  let dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Mô tả sự cố' }), { target: { value: 'Phát hiện vết xước cần xác minh.' } });
  failIncident = true;
  fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi bộ phận vận hành' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Chưa gửi được sự cố');
  failIncident = false;
  dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi bộ phận vận hành' }));
  expect(await screen.findByText('Đã gửi báo cáo sự cố cho bộ phận vận hành.')).toBeInTheDocument();
  const bodies = global.fetch.mock.calls.filter(([url]) => url === '/api/garage/incidents').map(([, options]) => JSON.parse(options.body));
  expect(bodies).toHaveLength(2);
  expect(bodies[0].requestId).toBe(bodies[1].requestId);
  expect(bodies[0].vehicleId).toBe(vehicleId);
  expect(await screen.findByText('Đã gửi vận hành')).toBeInTheDocument();
});
