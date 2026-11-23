import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const services = [
  { name: 'BE', directory: 'BE', command: 'start' },
  { name: 'FE', directory: 'FE', command: 'run dev' },
];
const children = [];
let stopping = false;

function stopAll(except) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child === except || child.exitCode !== null) continue;
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
}

for (const service of services) {
  const child = spawn(npm, service.command.split(' '), {
    cwd: path.join(root, service.directory),
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(`Could not start ${service.name}: ${error.message}`);
    stopAll(child);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    if (!stopping) {
      if (code && code !== 0) process.exitCode = code;
      stopAll(child);
    }
  });
}

process.on('SIGINT', () => stopAll());
process.on('SIGTERM', () => stopAll());
