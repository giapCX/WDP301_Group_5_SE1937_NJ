function quote(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function exportManagerReport(weeks, period) {
  const rows = [
    ['Giai đoạn', 'Booking', 'Doanh thu đã thu'],
    ...weeks.map((week) => [week.label, week.bookings, week.revenue]),
  ];
  const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `viettour-bao-cao-${period.year}-${String(period.month).padStart(2, '0')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
