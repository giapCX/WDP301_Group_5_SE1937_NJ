import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IncidentReviewCard from './IncidentReviewCard';

const item = { id: 'incident', status: 'pending_review', caseNumber: 'SC-TEST', description: 'Garage damage report', investigation: { review_status: 'proposed' }, compensationClaims: [{ requested_amount: 100, proposed_amount: 80, decision: 'pending', evidence_basis: 'Before and after comparison', renter_response: 'disputed' }] };

test('pending is actionable after Operation investigation and sends the exact claim index', async () => {
  const reviewCompensation = jest.fn().mockResolvedValue({});
  const prompt = jest.spyOn(window, 'prompt').mockReturnValueOnce('80').mockReturnValueOnce('Evidence reviewed');
  try {
    render(<IncidentReviewCard item={item} reviewCompensation={reviewCompensation} act={(promise) => promise} />);
    expect(screen.getByText('Khách có bất đồng')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt bồi thường' }));
    await waitFor(() => expect(reviewCompensation).toHaveBeenCalledWith('incident', { decision: 'approve', amount: 80, note: 'Evidence reviewed', claimIndex: 0 }));
  } finally { prompt.mockRestore(); }
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
  const prompt = jest.spyOn(window, 'prompt').mockReturnValueOnce('Bổ sung ảnh vị trí hư hỏng.');
  try {
    render(<IncidentReviewCard
      item={{ ...item, status: 'pending_manager', investigation: { review_status: 'submitted' } }}
      reviewIncident={reviewIncident}
      act={(promise) => promise}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu Operator bổ sung' }));
    await waitFor(() => expect(reviewIncident).toHaveBeenCalledWith('incident', {
      action: 'request_information',
      note: 'Bổ sung ảnh vị trí hư hỏng.',
    }));
  } finally { prompt.mockRestore(); }
});

test('incident waiting for Operator cannot be resolved by Manager', () => {
  render(<IncidentReviewCard item={{ ...item, status: 'need_more_information' }} act={jest.fn()} />);
  expect(screen.getByText('Đang chờ Operator bổ sung hồ sơ; Manager chưa thể kết luận.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Kết luận / đóng hồ sơ' })).not.toBeInTheDocument();
});
