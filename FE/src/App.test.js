import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const listing = {
  _id: '070000000000000000000001',
  title: 'Toyota Vios',
  daily_price: 600000,
  photos: [],
  pickup_location: { city: 'Hà Nội' },
  vehicle: {
    brand: 'Toyota',
    model: 'Vios',
    manufacture_year: 2024,
    seats: 5,
    vehicle_type: 'Sedan',
    fuel_type: 'gasoline',
    transmission: 'automatic',
  },
};
const response = (total = 7, page = 1) => ({
  ok: true,
  json: async () => ({
    data: [listing],
    pagination: { page, limit: 6, total, totalPages: Math.ceil(total / 6) },
  }),
});
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(response());
});
afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

test('fetches listings and sends keyword, filters and sort to the backend', async () => {
  render(<App />);
  expect(
    await screen.findByRole('heading', { name: 'Toyota Vios' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('7 xe');
  userEvent.type(screen.getByRole('searchbox'), 'Toyota');
  userEvent.click(screen.getByRole('button', { name: 'ϟ Điện VinFast' }));
  userEvent.click(
    screen.getByRole('checkbox', { name: 'SUV gầm cao (5–7 chỗ)' }),
  );
  userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'Sắp xếp:' }),
    'price_asc',
  );
  await waitFor(() => {
    const params = new URL(
      global.fetch.mock.calls.at(-1)[0],
      'http://localhost',
    ).searchParams;
    expect(params.get('q')).toBe('Toyota');
    expect(params.get('fuelType')).toBe('electric');
    expect(params.get('vehicleType')).toBe('suv');
    expect(params.get('sort')).toBe('price_asc');
  });
  // The component renders the server result; it never filters the returned gasoline car locally.
  expect(
    await screen.findByRole('heading', { name: 'Toyota Vios' }),
  ).toBeInTheDocument();
});
test('requests the next page and resets pagination when filters change', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Toyota Vios' });
  userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() =>
    expect(global.fetch.mock.calls.at(-1)[0]).toContain('page=2'),
  );
  userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'Số chỗ' }),
    '7',
  );
  await waitFor(() => {
    expect(global.fetch.mock.calls.at(-1)[0]).toContain('page=1');
    expect(global.fetch.mock.calls.at(-1)[0]).toContain('seats=7');
  });
});
test('validates dates and submits city plus ISO dates to the backend', async () => {
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: 'Thay đổi' }));
  fireEvent.change(screen.getByLabelText('Nhận xe'), {
    target: { value: '2026-11-15T10:00' },
  });
  fireEvent.change(screen.getByLabelText('Trả xe'), {
    target: { value: '2026-11-14T10:00' },
  });
  userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Thời gian trả xe phải sau thời gian nhận xe.',
  );
  fireEvent.change(screen.getByLabelText('Trả xe'), {
    target: { value: '2026-11-18T10:00' },
  });
  userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'Địa điểm nhận xe' }),
    'Hà Nội',
  );
  userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
  await waitFor(() => {
    const params = new URL(
      global.fetch.mock.calls.at(-1)[0],
      'http://localhost',
    ).searchParams;
    expect(params.get('city')).toBe('Hà Nội');
    expect(params.get('startAt')).toBe(
      new Date('2026-11-15T10:00').toISOString(),
    );
    expect(params.get('endAt')).toBe(
      new Date('2026-11-18T10:00').toISOString(),
    );
  });
});
test('shows server errors and retries without falling back to demo cars', async () => {
  global.fetch.mockRejectedValueOnce(
    new Error('Không thể kết nối đến máy chủ.'),
  );
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Không thể kết nối',
  );
  expect(screen.queryAllByRole('article')).toHaveLength(0);
  userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(
    await screen.findByRole('heading', { name: 'Toyota Vios' }),
  ).toBeInTheDocument();
});
test('sends saved IDs to the backend and shows the empty result', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Toyota Vios' });
  userEvent.click(screen.getByRole('button', { name: 'Lưu Toyota Vios' }));
  userEvent.click(screen.getByRole('button', { name: 'Đã lưu (1)' }));
  await waitFor(() =>
    expect(global.fetch.mock.calls.at(-1)[0]).toContain(`ids=${listing._id}`),
  );
  await screen.findByRole('heading', { name: 'Toyota Vios' });
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: [],
      pagination: { total: 0, totalPages: 0, page: 1, limit: 6 },
    }),
  });
  userEvent.click(screen.getByRole('button', { name: 'Bỏ lưu Toyota Vios' }));
  expect(
    await screen.findByText('Chưa tìm thấy xe phù hợp'),
  ).toBeInTheDocument();
});
