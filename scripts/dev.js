import concurrently from 'concurrently';

const { result } = concurrently([
  { name: 'BE', command: 'npm run dev --prefix BE' },
  { name: 'FE', command: 'npm run dev --prefix FE' },
], { killOthers: ['failure', 'success'] });

try {
  await result;
} catch {
  process.exitCode = 1;
}
