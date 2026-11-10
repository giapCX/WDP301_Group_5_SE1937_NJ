import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GaragePhotoUpload from './GaragePhotoUpload';

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { delete global.fetch; });

test('uploads an image and stores its server key instead of a base64 report attachment', async () => {
  const key = 'garage-photos/02000000000000000000000f/12345678-1234-1234-1234-123456789012.png';
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { key, name: 'car.png' } }) });
  const change = jest.fn();
  const busy = jest.fn();
  render(<GaragePhotoUpload photos={[]} onChange={change} onBusyChange={busy} />);
  fireEvent.change(screen.getByLabelText('Chọn ảnh hiện trạng xe'), { target: { files: [new File(['image-bytes'], 'car.png', { type: 'image/png' })] } });
  await waitFor(() => expect(change).toHaveBeenCalledWith([{ key, name: 'car.png' }]));
  expect(global.fetch).toHaveBeenCalledWith('/api/garage/photos', expect.objectContaining({ method: 'POST' }));
  expect(change.mock.calls[0][0][0].data).toBeUndefined();
  expect(busy).toHaveBeenLastCalledWith(false);
});

test('failed upload keeps the report attachment list unchanged and offers an error', async () => {
  global.fetch.mockRejectedValue(new Error('Không tải ảnh lên được'));
  const change = jest.fn();
  render(<GaragePhotoUpload photos={[]} onChange={change} />);
  fireEvent.change(screen.getByLabelText('Chọn ảnh hiện trạng xe'), { target: { files: [new File(['image'], 'car.png', { type: 'image/png' })] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải ảnh lên được');
  expect(change).not.toHaveBeenCalled();
});
