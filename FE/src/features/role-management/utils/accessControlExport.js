const CSV_COLUMNS = [
  { label: 'Họ tên', value: (account) => account.name },
  { label: 'Email', value: (account) => account.email },
  { label: 'Vai trò', value: (account) => account.role },
  { label: 'Trạng thái', value: (account) => account.status },
  { label: 'Hoạt động gần nhất', value: (account) => account.lastActivity },
];

function escapeCsv(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function exportAccountsCsv(accounts, filename = 'viettour-tai-khoan.csv') {
  const rows = [
    CSV_COLUMNS.map(({ label }) => label),
    ...accounts.map((account) => CSV_COLUMNS.map(({ value }) => value(account))),
  ];
  const content = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  const objectUrl = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' }));
  const downloadLink = document.createElement('a');
  downloadLink.href = objectUrl;
  downloadLink.download = filename;
  downloadLink.click();
  URL.revokeObjectURL(objectUrl);
}
