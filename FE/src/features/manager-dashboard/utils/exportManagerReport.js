const REPORT_COLUMNS = [
  { label: 'Biển số', value: (vehicle) => vehicle.plateNumber },
  { label: 'Phương tiện', value: (vehicle) => vehicle.name },
  { label: 'Phân khúc', value: (vehicle) => vehicle.category || '' },
  { label: 'Số chỗ', value: (vehicle) => vehicle.seats ?? '' },
  { label: 'Khách thuê', value: (vehicle) => vehicle.booking?.renterName || '' },
  { label: 'Tài xế', value: (vehicle) => vehicle.driver || '' },
  { label: 'Giá mỗi ngày', value: (vehicle) => vehicle.dailyPrice ?? '' },
  { label: 'Trạng thái', value: (vehicle) => vehicle.status },
];

function quote(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function exportManagerReport(vehicles, period) {
  const rows = [
    REPORT_COLUMNS.map(({ label }) => label),
    ...vehicles.map((vehicle) => REPORT_COLUMNS.map(({ value }) => value(vehicle))),
  ];
  const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `viettour-doi-xe-${period.year}-${String(period.month).padStart(2, '0')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
