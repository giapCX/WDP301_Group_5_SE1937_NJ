const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  route: 'M6 3v11a4 4 0 0 0 8 0V9 M3 6l3-3 3 3 M11 12l3-3 3 3 M18 3h3v3h-3z',
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16',
  car: 'M3 16V9l3-5h12l3 5v7H3z M3 10h18 M6 16v4 M18 16v4 M6 13h2 M16 13h2',
  wrench: 'M14.7 6.3a5 5 0 0 0-6.4 6.4l-5.6 5.6a2 2 0 0 0 2.8 2.8l5.6-5.6a5 5 0 0 0 6.4-6.4l-3 3-3-3 3.2-2.8Z',
  list: 'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5',
  pin: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M9 9a3 3 0 1 1 4 3v2 M12 17h.01',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6',
  bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4 M12 2v2',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a8 8 0 0 1 16 0v3',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  chevron: 'M9 5l7 7-7 7',
  check: 'M5 12l4 4L19 6',
  close: 'M6 6l12 12 M6 18L18 6',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0 1 14 6 M4 12a8 8 0 0 0 14 6',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
};

export default function BookingIcon({ name, size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.list} />
    </svg>
  );
}
