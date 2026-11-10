import { formatOperationDate, formatOperationMoney } from './operationConfig';

// Keep API-to-table formatting out of the page component so each workflow stays easy to scan.
export function createOperationRows(items, section) {
  return items.map((item) => {
    if (section === 'vehicles') {
      return {
        id: item.id,
        primary: `${item.brand || ''} ${item.model || ''}`.trim() || 'Hồ sơ xe',
        secondary: item.owner?.full_name,
        tertiary: item.licensePlate,
        status: item.onboardingStatus,
        date: formatOperationDate(item.updatedAt),
        amount: item.inspection ? 'Đã phân công' : 'Chưa lên lịch',
      };
    }

    if (section === 'bookings') {
      return {
        id: item.id,
        primary: item.bookingCode,
        secondary: item.renter?.full_name,
        tertiary: item.vehicle
          ? `${item.vehicle.brand} ${item.vehicle.model} · ${item.vehicle.license_plate}`
          : '—',
        status: item.status,
        date: formatOperationDate(item.startAt),
        amount: formatOperationMoney(item.rentalFeeAmount),
      };
    }

    if (section === 'listings') {
      return {
        id: item.id,
        primary: item.title,
        secondary: item.vehicle
          ? `${item.vehicle.brand} ${item.vehicle.model} · ${item.vehicle.license_plate}`
          : 'Xe chưa liên kết',
        tertiary: item.pickupLocation?.city || '',
        status: item.status,
        date: formatOperationDate(item.updatedAt),
        amount: formatOperationMoney(item.dailyPrice),
      };
    }

    if (section === 'overdue') {
      return {
        id: item.id,
        primary: item.bookingCode,
        secondary: item.renter?.full_name,
        tertiary: item.renter?.phone || item.renter?.email || 'Không có thông tin liên hệ',
        status: item.handledAt ? 'handled' : 'ongoing',
        date: `${item.overdueHours} giờ quá hạn · hạn ${formatOperationDate(item.endAt)}`,
        amount: formatOperationMoney(item.lateFeeEstimate),
      };
    }

    return {
      id: item.id,
      primary: `${item.caseNumber} · ${item.caseType}`,
      secondary: item.reporter?.full_name || 'Người gửi',
      tertiary: item.description,
      status: item.status,
      date: formatOperationDate(item.updatedAt),
      amount: item.trafficViolation
        ? formatOperationMoney(item.trafficViolation.fine_amount_claimed)
        : '',
    };
  });
}
