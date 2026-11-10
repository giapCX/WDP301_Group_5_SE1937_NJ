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
