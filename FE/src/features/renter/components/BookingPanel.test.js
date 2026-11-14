import { fireEvent, render, screen } from '@testing-library/react';
import BookingPanel from './BookingPanel';
import { getListing } from '../../listings/api/listingApi';
import { getRenter, postRenter } from '../api/renterApi';
jest.mock('../../listings/api/listingApi', () => ({ getListing: jest.fn() }));
jest.mock('../api/renterApi', () => ({ getRenter: jest.fn(), postRenter: jest.fn(), vnd: value => String(value) }));
beforeEach(() => {
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => 'booking-test-request' } });
  localStorage.setItem('xedi_token', 'renter-test');
  getListing.mockResolvedValue({ data: { _id: 'listing-1', description: 'Xe kiểm thử', daily_price: 700000, security_deposit_amount: 3000000, photos: [] } });
  getRenter.mockResolvedValue({ data: { policies: {} } });
  postRenter.mockReset();
});
afterEach(() => { localStorage.clear(); });
test('clicking rent without accepting terms explains what is missing', async () => {
  render(<BookingPanel listingId="listing-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Thuê xe' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng tích đồng ý');
  expect(postRenter).not.toHaveBeenCalled();
});
test('booking rejection is shown beside the rent button with a profile link', async () => {
  postRenter.mockRejectedValue(new Error('Cần xác minh CCCD/GPLX và bổ sung địa chỉ trong hồ sơ.'));
  render(<BookingPanel listingId="listing-1" />);
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Thuê xe' }));
  const error = await screen.findByRole('alert');
  expect(error).toHaveTextContent('Cần xác minh CCCD/GPLX');
  expect(error).toHaveFocus();
  expect(screen.getByRole('link', { name: /Mở hồ sơ để hoàn thiện/ })).toHaveAttribute('href', '#/renter/profile');
  expect(screen.getByRole('button', { name: 'Thuê xe' })).toBeEnabled();
});
