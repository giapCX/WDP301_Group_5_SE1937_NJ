import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';

const listing = {
  _id: '070000000000000000000001',
  title: 'Toyota Vios - xe tự lái',
  photos: [],
  pickup_location: { city: 'Hà Nội' },
  daily_price: 600000,
  vehicle: {
    brand: 'Toyota',
    model: 'Vios',
    manufacture_year: 2021,
    seats: 5,
    fuel_type: 'gasoline',
    transmission: 'automatic',
  },
};

beforeEach(() => {
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () =>
      url === '/api/homepage'
        ? {
            data: {
              totalListings: 1,
              cities: ['Hà Nội'],
              policies: {
                commissionPercent: 15,
                freeCancellationHours: 48,
                depositRefundBusinessDays: 3,
              },
            },
          }
        : { data: [listing], pagination: { total: 1 } },
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

test('loads database vehicles and shows the agreed refund policy', async () => {
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Toyota Vios (2021)' })).toBeInTheDocument();
  expect(screen.getByText('600.000 đ')).toBeInTheDocument();
  expect(screen.getByText('3 ngày làm việc')).toBeInTheDocument();
  expect(screen.queryByText(/Hoàn tiền tự động trong 24 giờ/)).not.toBeInTheDocument();
  expect(screen.getByText('Không cần chủ xe duyệt từng đơn')).toBeInTheDocument();
});

test('electric category and sort are sent to the API', async () => {
  render(<App />);
  await screen.findByText('600.000 đ');
  fireEvent.click(screen.getByRole('button', { name: 'Xe điện' }));
  fireEvent.change(screen.getByLabelText('Sắp xếp:'), { target: { value: 'price_asc' } });
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('fuelType=electric'),
      expect.anything(),
    ),
  );
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sort=price_asc'),
      expect.anything(),
    ),
  );
});

test('failed requests show retry and do not substitute fake vehicles', async () => {
  global.fetch.mockRejectedValue(new Error('Mất kết nối'));
  render(<App />);
  expect(
    await screen.findByRole('heading', { name: 'Chưa thể tải danh sách xe' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('600.000 đ')).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Thử lại' }));
  await waitFor(() => expect(global.fetch.mock.calls.length).toBeGreaterThan(3));
});
