import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingWorkspace from './components/BookingWorkspace';
import BookingPanel from './components/BookingPanel';
import RenterPage from './pages/RenterPage';
import { Otp } from './components/Controls';
const booking = {
  _id: '080000000000000000000001',
  booking_code: 'BK-API-ONLY',
  status: 'awaiting_payment',
  rental_fee_amount: 1400000,
  deposit_amount_snapshot: 3000000,
  hold_expires_at: new Date(Date.now() + 900000).toISOString(),
  pricing_snapshot: {
    daily_price: 700000,
    charged_days: 2
  }
};
const agreement = {
  contract_number: 'RENT-API',
  status: 'pending_signature',
  terms_snapshot: {
    rental_fee_amount: 1400000,
    deposit_amount: 3000000,
    cancellation: {
      version: 7,
      config: {
        free_cancel_before_hours: 72
      }
    }
  },
  signing_info: {}
};
const reply = data => ({
  ok: true,
  json: async () => data
});
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/#/renter/bookings');
  global.fetch = jest.fn();
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: {
      randomUUID: () => 'test-request-unique'
    }
  });
});
afterEach(() => {
  delete global.fetch;
  jest.restoreAllMocks();
});
test('renter workspace requests login without showing fabricated history', () => {
  render(<RenterPage />);
  expect(screen.getByText('Đăng nhập để xem dữ liệu của bạn.')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(screen.queryByText('BK-API-ONLY')).not.toBeInTheDocument();
});
test('renter homepage contains renter navigation, live trip totals and car search', async () => {
  window.history.replaceState(null, '', '/#/renter');
  localStorage.setItem('xedi_token', 'renter-token');
  global.fetch.mockImplementation(async url => {
    if (url === '/api/renter/config') return reply({ data: { services: {}, policies: {} } });
    if (url === '/api/renter/profile') return reply({ data: { full_name: 'Khách Thuê', identity_kyc: { status: 'verified' } } });
    if (url.startsWith('/api/renter/bookings')) return reply({ data: [], pagination: { total: url.includes('status=active') ? 4 : 2, totalPages: 1 } });
    if (url === '/api/renter/incidents') return reply({ data: [] });
    if (url.startsWith('/api/listings?')) return reply({ data: [], pagination: { total: 0 } });
    throw new Error('Unexpected API: ' + url);
  });
  render(<RenterPage />);
  expect(screen.getByRole('heading', { name: 'Trang chủ khách thuê', level: 1 })).toBeInTheDocument();
  await screen.findByText('Chào Khách Thuê!');
  expect(screen.getByText('4')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Tìm & đặt xe' })).toHaveAttribute('href', '#/renter/cars');
  expect(screen.getByRole('link', { name: 'Hồ sơ & xác minh' })).toHaveAttribute('href', '#/renter/profile');
  expect(screen.getByRole('link', { name: 'Chuyến đi & thanh toán' })).toHaveAttribute('href', '#/renter/bookings');
  expect(screen.getByRole('link', { name: 'Sự cố đã báo cáo' })).toHaveAttribute('href', '#/renter/incidents');
  expect(screen.getByRole('button', { name: 'Tìm xe phù hợp' })).toBeInTheDocument();
  expect(screen.queryByText('Trở thành chủ xe')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Tìm & đặt xe' }));
  await screen.findByRole('heading', { name: 'Tìm và đặt xe', level: 1 });
});
test('booking workspace displays stored policy and blocks unconfigured payment', async () => {
  global.fetch.mockResolvedValue(reply({
    data: {
      booking,
      agreement,
      payments: [],
      deposit: null
    }
  }));
  render(<BookingWorkspace bookingId={booking._id} config={{
    services: {
      payment: 'unconfigured'
    }
  }} />);
  await screen.findByText('BK-API-ONLY');
  expect(screen.getByText(/72 giờ/)).toBeInTheDocument();
  expect(screen.getByText(/Chưa cấu hình cổng thanh toán/)).toBeInTheDocument();
  expect(screen.getByRole('button', {
    name: /Thanh toán mô phỏng/
  })).toBeDisabled();
  expect(screen.getByRole('checkbox', {
    name: /Tôi đã đọc đến cuối/
  })).toBeDisabled();
});
test('new booking waits for the platform signature before showing payment', async () => {
  global.fetch.mockResolvedValue(reply({
    data: { booking, agreement: { ...agreement, _id: 'agreement-1', status: 'pending_signatures',
      contract_document: { hash: 'prepared' }, signing_info: { renter_confirmed: true } },
      payments: [], deposit: null },
  }));
  render(<BookingWorkspace bookingId={booking._id} config={{ services: { payment: 'demo' } }} />);
  expect(await screen.findByText('Khách thuê đã ký · XeDi chưa ký')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem hợp đồng thuê' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Thanh toán mô phỏng/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Ký hợp đồng bằng OTP/ })).not.toBeInTheDocument();
});

test('OTP input starts empty and demo is explicitly labelled', async () => {
  const onChange = jest.fn();
  global.fetch.mockResolvedValue(reply({
    data: {
      challenge_id: '090000000000000000000001',
      expires_at: new Date(Date.now() + 120000),
      demo: true,
      demo_code: '123456'
    }
  }));
  render(<Otp registration target={{
    email: 'new@example.com',
    phone: '0911111111'
  }} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', {
    name: 'Gửi mã OTP'
  }));
  await screen.findByText('123456');
  expect(screen.getByText(/Chưa gửi SMS/)).toBeInTheDocument();
  expect(screen.getByLabelText('Mã OTP')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Mã OTP'), {
    target: {
      value: '123456'
    }
  });
  expect(onChange).toHaveBeenLastCalledWith({
    challenge_id: '090000000000000000000001',
    otp: '123456'
  });
});
test('booking panel reads listing price then posts reservation without client-controlled totals', async () => {
  localStorage.setItem('xedi_token', 'test-token');
  global.fetch.mockImplementation(async (url, options) => {
    if (url === '/api/listings/070000000000000000000001') return reply({
      data: {
        _id: '070000000000000000000001',
        title: 'Xe từ MongoDB',
        daily_price: 700000,
        security_deposit_amount: 3000000,
        photos: [],
        vehicle: {
          brand: 'Test',
          model: 'Car',
          seats: 5
        },
        pickup_location: {
          branch_name: 'Gara API'
        }
      }
    });
    if (url === '/api/renter/config') return reply({
      data: {
        policies: {},
        services: {}
      }
    });
    if (url === '/api/renter/bookings') return reply({
      data: {
        booking
      }
    });
    throw new Error('Unexpected API: ' + url);
  });
  render(<BookingPanel listingId="070000000000000000000001" initialDates={{
    start: '2026-12-01T09:00',
    end: '2026-12-03T09:00'
  }} />);
  await screen.findByText(/Gara API/);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('button', {
    name: 'Gửi yêu cầu thuê xe'
  }).closest('form'));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/renter/bookings', expect.objectContaining({
    method: 'POST'
  })));
  const call = global.fetch.mock.calls.find(([url]) => url === '/api/renter/bookings');
  const body = JSON.parse(call[1].body);
  expect(body.listing_id).toBe('070000000000000000000001');
  expect(body.rental_fee_amount).toBeUndefined();
  expect(body.agreed).toBe(true);
});
