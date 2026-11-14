import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IncidentReviewCard from './IncidentReviewCard';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

const item = { id: 'incident', status: 'pending_review', caseNumber: 'SC-TEST', description: 'Garage damage report', investigation: { review_status: 'proposed' }, compensationClaims: [{ requested_amount: 100, proposed_amount: 80, decision: 'pending', evidence_basis: 'Before and after comparison', renter_response: 'disputed' }] };

test('pending is actionable after Operation investigation and sends the exact claim index', async () => {
  const reviewCompensation = jest.fn().mockResolvedValue({});
  render(<IncidentReviewCard item={item} reviewCompensation={reviewCompensation} act={(promise) => promise} />);
  expect(screen.getByText('Khách có bất đồng')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt bồi thường' }));
  fireEvent.change(screen.getByLabelText('Căn cứ quyết định bồi thường'), { target: { value: 'Evidence reviewed' } });
  fireEvent.change(screen.getByLabelText('Số hợp đồng và điều khoản áp dụng'), { target: { value: 'RENT-01, Điều 10' } });
  fireEvent.change(screen.getByLabelText('Mã hoặc tên chứng từ'), { target: { value: 'Báo giá BG-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(reviewCompensation).toHaveBeenCalledWith('incident', {
    decision: 'approve', amount: 80, note: 'Evidence reviewed', claimIndex: 0,
    settlementMode: 'record_only', contractBasis: 'RENT-01, Điều 10', evidenceReference: 'Báo giá BG-01',
  }));
});

test('Garage report or uninvestigated claim never enables a compensation approval', () => {
  render(<IncidentReviewCard item={{ ...item, investigation: { review_status: 'pending' } }} act={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Duyệt bồi thường' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Kết luận / đóng hồ sơ' })).not.toBeInTheDocument();
});

test('Manager can decide a pending claim after Operator submits the factual report', () => {
  const submitted = {
    ...item,
    status: 'pending_manager',
    investigation: { review_status: 'submitted' },
    compensationClaims: [{ requested_amount: 100, decision: 'pending', renter_response: 'not_received' }],
  };
  render(<IncidentReviewCard item={submitted} act={jest.fn()} />);
  expect(screen.getByText('Operator đã gửi thông tin và chứng cứ; Manager tự đánh giá, quyết định khoản bồi thường.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Duyệt bồi thường' })).toBeEnabled();
});

test('Manager can request more information only from a submitted incident', async () => {
  const reviewIncident = jest.fn().mockResolvedValue({});
  render(<IncidentReviewCard
    item={{ ...item, status: 'pending_manager', investigation: { review_status: 'submitted' } }}
    reviewIncident={reviewIncident}
    act={(promise) => promise}
  />);
  fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu Operator bổ sung' }));
  fireEvent.change(screen.getByLabelText('Thông tin hoặc chứng cứ cần bổ sung'), { target: { value: 'Bổ sung ảnh vị trí hư hỏng.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(reviewIncident).toHaveBeenCalledWith('incident', {
    action: 'request_information',
    note: 'Bổ sung ảnh vị trí hư hỏng.',
  }));
});

test('incident waiting for Operator cannot be resolved by Manager', () => {
  render(<IncidentReviewCard item={{ ...item, status: 'need_more_information' }} act={jest.fn()} />);
  expect(screen.getByText('Đang chờ Operator bổ sung hồ sơ; Manager chưa thể kết luận.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Kết luận / đóng hồ sơ' })).not.toBeInTheDocument();
});

test('Manager can retry a failed decision without re-entering evidence notes', async () => {
  const reviewIncident = jest.fn().mockRejectedValueOnce(new Error('Hồ sơ vừa được cập nhật.')).mockResolvedValueOnce({});
  render(<IncidentReviewCard
    item={{ ...item, status: 'pending_manager', investigation: { review_status: 'submitted' } }}
    reviewIncident={reviewIncident} act={(promise) => promise}
  />);
  fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu Operator bổ sung' }));
  const note = screen.getByLabelText('Thông tin hoặc chứng cứ cần bổ sung');
  fireEvent.change(note, { target: { value: 'Bổ sung ảnh vị trí hư hỏng.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Hồ sơ vừa được cập nhật.');
  expect(note).toHaveValue('Bổ sung ảnh vị trí hư hỏng.');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(reviewIncident).toHaveBeenCalledTimes(2);
});
