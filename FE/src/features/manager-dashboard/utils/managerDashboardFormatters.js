const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
});

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

export function formatCompactCurrency(value) {
  const amount = Number(value) || 0;
  return `${compactCurrencyFormatter.format(amount)} ₫`;
}

export function formatPercent(value) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Number(value) || 0)}%`;
}

export function formatDate(value) {
  if (!value) return 'Chưa có lịch';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có lịch' : dateFormatter.format(date);
}

export function monthLabel(year, month) {
  return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

