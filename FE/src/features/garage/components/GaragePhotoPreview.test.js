import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Modal from '../../../components/ui/Modal';
import { getGaragePhoto } from '../api/garageApi';
import GaragePhotoPreview from './GaragePhotoPreview';
import GaragePhotoUpload from './GaragePhotoUpload';

jest.mock('../api/garageApi', () => ({ getGaragePhoto: jest.fn() }));

const photo = { key: 'garage-photos/owner/photo.jpg', name: 'Hiện trạng xe.jpg' };
const originalCreateUrl = URL.createObjectURL;
const originalRevokeUrl = URL.revokeObjectURL;
const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => 'blob:garage-photo');
  URL.revokeObjectURL = jest.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  getGaragePhoto.mockResolvedValue(new Blob(['image'], { type: 'image/jpeg' }));
});

afterEach(() => {
  URL.createObjectURL = originalCreateUrl;
  URL.revokeObjectURL = originalRevokeUrl;
  HTMLDialogElement.prototype.showModal = originalShowModal;
  HTMLDialogElement.prototype.close = originalClose;
});

test('opens the authenticated image at full size, zooms and closes without loading a public URL', async () => {
  const { unmount } = render(<GaragePhotoPreview photo={photo} />);
  fireEvent.click(await screen.findByRole('button', { name: `Xem ảnh ${photo.name}` }));
  const viewer = screen.getByRole('dialog', { name: 'Ảnh hiện trạng' });
  expect(within(viewer).getByRole('img')).toHaveAttribute('src', 'blob:garage-photo');
  fireEvent.click(within(viewer).getByRole('button', { name: 'Phóng to 2×' }));
  expect(within(viewer).getByLabelText('Vùng xem ảnh')).toHaveClass('is-zoomed');
  fireEvent.click(within(viewer).getByRole('button', { name: 'Vừa màn hình' }));
  expect(within(viewer).getByLabelText('Vùng xem ảnh')).not.toHaveClass('is-zoomed');
  fireEvent.click(within(viewer).getByRole('button', { name: 'Đóng ảnh' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(getGaragePhoto).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:garage-photo');
});

test('Escape cancel closes only the photo viewer and keeps the report open', async () => {
  const closeReport = jest.fn();
  render(<Modal title="Biên bản kiểm định" onClose={closeReport}><GaragePhotoPreview photo={photo} /></Modal>);
  fireEvent.click(await screen.findByRole('button', { name: `Xem ảnh ${photo.name}` }));
  const viewer = screen.getByRole('dialog', { name: 'Ảnh hiện trạng' });
  fireEvent(viewer, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog', { name: 'Ảnh hiện trạng' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Biên bản kiểm định' })).toBeInTheDocument();
  expect(closeReport).not.toHaveBeenCalled();
});

test('allows viewing read-only attachments and keeps remove separate from preview', async () => {
  const onChange = jest.fn();
  const { rerender } = render(<GaragePhotoUpload photos={[photo]} readOnly onChange={onChange} />);
  const trigger = await screen.findByRole('button', { name: `Xem ảnh ${photo.name}` });
  expect(screen.queryByRole('button', { name: `Xóa ảnh ${photo.name}` })).not.toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Đóng ảnh' }));
  rerender(<GaragePhotoUpload photos={[photo]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: `Xóa ảnh ${photo.name}` }));
  expect(onChange).toHaveBeenCalledWith([]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('failed image requests show the existing error without an unusable viewer', async () => {
  getGaragePhoto.mockRejectedValue(new Error('Missing image'));
  render(<GaragePhotoPreview photo={photo} />);
  await waitFor(() => expect(screen.getByText('Ảnh chưa có tệp hoặc không tải được')).toBeInTheDocument());
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
