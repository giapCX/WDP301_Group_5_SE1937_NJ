import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GaragePage from './GaragePage';
import { GARAGE_STORAGE_KEY } from '../hooks/useGarageWorkspace';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/garage#overview');
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
});

function openTask(section, id) {
  userEvent.click(
    screen.getByRole('link', { name: new RegExp(`^${section}`) }),
  );
  userEvent.click(screen.getByRole('button', { name: `Xem ${id}` }));
  return screen.getByRole('dialog');
}

test('saves inspection drafts across reloads and sends a proposal without approving it', () => {
  const view = render(<GaragePage />);
  let dialog = openTask('Kiểm định xe', 'GS-001');
  fireEvent.change(within(dialog).getByLabelText('Ghi chú tình trạng'), {
    target: { value: 'Kiểm tra toàn bộ xe trước khi tiếp nhận.' },
  });
  userEvent.click(within(dialog).getByRole('button', { name: 'Lưu bản nháp' }));
  expect(
    JSON.parse(localStorage.getItem(GARAGE_STORAGE_KEY)).tasks.find(
      (task) => task.id === 'GS-001',
    ).status,
  ).toBe('draft');
  view.unmount();
  render(<GaragePage />);
  userEvent.click(screen.getByRole('button', { name: 'Xem GS-001' }));
  dialog = screen.getByRole('dialog');
  expect(within(dialog).getByLabelText('Ghi chú tình trạng')).toHaveValue(
    'Kiểm tra toàn bộ xe trước khi tiếp nhận.',
  );
  userEvent.click(
    within(dialog).getByRole('button', { name: 'Tất cả bình thường' }),
  );
  userEvent.click(within(dialog).getByLabelText('Đề xuất đạt'));
  userEvent.click(
    within(dialog).getByRole('button', { name: 'Gửi đề xuất kiểm định' }),
  );
  const saved = JSON.parse(localStorage.getItem(GARAGE_STORAGE_KEY));
  expect(saved.tasks.find((task) => task.id === 'GS-001').status).toBe(
    'submitted',
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Đã gửi đề xuất kiểm định cho Manager',
  );
  userEvent.click(screen.getByRole('button', { name: 'Xem GS-001' }));
  dialog = screen.getByRole('dialog');
  expect(
    within(dialog).getByText('Biên bản đã gửi được mở ở chế độ chỉ xem.'),
  ).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Số km trên đồng hồ')).toBeDisabled();
  expect(
    within(dialog).queryByRole('button', { name: 'Lưu bản nháp' }),
  ).not.toBeInTheDocument();
});

test('blocks handover when payment is not confirmed', () => {
  render(<GaragePage />);
  const dialog = openTask('Bàn giao xe', 'GS-006');
  expect(
    within(dialog).getByText('Chưa xác nhận thanh toán'),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Xác nhận bàn giao xe' }),
  ).toBeDisabled();
  expect(
    within(dialog).getByRole('button', { name: 'Lưu bản nháp' }),
  ).toBeEnabled();
});

test('return validation rejects lower mileage and reports new damage to operations', () => {
  render(<GaragePage />);
  const dialog = openTask('Nhận trả xe', 'GS-003');
  userEvent.click(
    within(dialog).getByRole('button', { name: 'Tất cả bình thường' }),
  );
  fireEvent.change(within(dialog).getByLabelText('Số km trên đồng hồ'), {
    target: { value: '1' },
  });
  fireEvent.submit(dialog.querySelector('form'));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Số km');
  fireEvent.change(within(dialog).getByLabelText('Số km trên đồng hồ'), {
    target: { value: '42300' },
  });
  userEvent.selectOptions(
    within(dialog).getByLabelText('Ngoại thất'),
    'damaged',
  );
  fireEvent.change(within(dialog).getByLabelText('Ghi chú tình trạng'), {
    target: { value: 'Phát hiện vết xước mới ở cản sau bên phải.' },
  });
  userEvent.click(
    within(dialog).getByLabelText('Đã ghi nhận xác nhận trả xe của khách thuê'),
  );
  userEvent.click(
    within(dialog).getByRole('button', { name: 'Xác nhận nhận trả xe' }),
  );
  const saved = JSON.parse(localStorage.getItem(GARAGE_STORAGE_KEY));
  expect(saved.tasks.find((task) => task.id === 'GS-003').status).toBe(
    'completed',
  );
  expect(saved.incidents).toHaveLength(1);
  expect(saved.incidents[0].description).toContain('vết xước');
  userEvent.click(screen.getByRole('link', { name: 'Báo cáo sự cố' }));
  expect(
    screen.getByText('Phát hiện vết xước mới ở cản sau bên phải.'),
  ).toBeInTheDocument();
});

test('filters assignments and resets preview data only after confirmation', () => {
  render(<GaragePage />);
  userEvent.click(screen.getByRole('link', { name: /^Kiểm định xe/ }));
  userEvent.type(
    screen.getByRole('textbox', { name: 'Tìm kiếm công việc' }),
    'Tucson',
  );
  expect(screen.getByText('Hyundai Tucson')).toBeInTheDocument();
  expect(screen.queryByText('VinFast VF 8 Plus')).not.toBeInTheDocument();
  userEvent.click(
    screen.getByRole('button', { name: 'Khôi phục dữ liệu mẫu' }),
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Giữ lại dữ liệu' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
