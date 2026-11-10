import { createOperationAccessService, createOperationContext } from '../../modules/operation/operation.context.js';
import { createOperationBookingService } from './operation-booking.service.js';
import { createOperationCaseService } from './operation-case.service.js';
import { createOperationDashboardService } from './operation-dashboard.service.js';
import { createOperationListingService } from './operation-listing.service.js';
import { createOperationOverdueService } from './operation-overdue.service.js';

// Compose workflow services here; each service owns one Operation queue/domain.
export function createOperationService(repository) {
  const context = createOperationContext(repository);
  return {
    ...createOperationAccessService(repository),
    ...createOperationDashboardService(repository),
    ...createOperationBookingService(repository, context),
    ...createOperationListingService(repository, context),
    ...createOperationCaseService(repository, context),
    ...createOperationOverdueService(repository, context),
  };
}
