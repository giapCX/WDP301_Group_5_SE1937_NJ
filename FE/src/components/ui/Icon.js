const paths = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  clipboard: 'M9 4H5v17h14V4h-4M9 2h6v5H9zM8 12h8m-8 4h5',
  garage: 'M3 21V8l9-5 9 5v13M6 21V10h12v11M6 14h12M6 18h12',
  clock: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0m9-5v5l3 2',
  history: 'M3 5v5h5M3 10a9 9 0 1 1 1 7m8-10v5l3 2',
  alert: 'm12 3 10 18H2Zm0 6v5m0 3v.01',
  search: 'M3 10a7 7 0 1 0 14 0 7 7 0 1 0-14 0m12 5 6 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  plus: 'M12 4v16M4 12h16',
  wrench: 'M14 5a5 5 0 0 0-6 6l-6 6a3 3 0 0 0 4 4l6-6a5 5 0 0 0 6-6l-4 3-3-3Z',
  arrowLeft: 'm15 5-7 7 7 7M8 12h13',
  car: 'M5 7 7 3h10l2 4M4 8h16v10H4zM7 18v3m10-3v3M4 12h16M7 9v2m10-2v2',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM10 10a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  calendar:
    'M3 5h18v16H3zM7 2v6m10-6v6M3 11h18m-13 4h1m3 0h1m3 0h1m-9 3h1m3 0h1',
  filter: 'M4 6h16M7 12h10m-7 6h4M8 3v6m8 0v6m-4 0v6',
  map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16',
  shield: 'm12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5Zm-4 9 3 3 5-6',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  arrow: 'm9 5 7 7-7 7',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  user: 'M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 22v-3a8 8 0 0 1 16 0v3',
  globe:
    'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M3 12h18M5 7h14M5 17h14M12 3c-5 4-5 14 0 18 5-4 5-14 0-18',
  menu: 'M4 6h16M4 12h16M4 18h16',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-8Z',
  tag: 'M3 3h9l9 9-9 9-9-9ZM8 8h.01',
  delivery:
    'M2 5h13v12H2Zm13 5h4l3 4v3h-7M4 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0m12 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  location: 'm21 3-7 18-4-7-7-4Z',
};
export default function Icon({ name, size = 18, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.car} />
    </svg>
  );
}
