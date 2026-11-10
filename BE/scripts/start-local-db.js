import { spawn } from 'node:child_process';
import { access, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const { MongoClient } = mongoose.mongo;
const directory = fileURLToPath(new URL('../storage/mongodb-local/', import.meta.url));
const uri = 'mongodb://127.0.0.1:27018/?directConnection=true';
const pause = () => new Promise((resolve) => setTimeout(resolve, 500));

async function executable() {
  if (process.env.MONGOD_BINARY) return process.env.MONGOD_BINARY;
  if (process.platform !== 'win32') return 'mongod';
  const root = join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Server');
  for (const version of (await readdir(root)).sort().reverse()) {
    const binary = join(root, version, 'bin', 'mongod.exe');
    try { await access(binary); return binary; } catch { /* Try another installed version. */ }
  }
  throw new Error('Install MongoDB Server or set MONGOD_BINARY to the mongod executable.');
}

async function connect() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 800, connectTimeoutMS: 800 });
  try { await client.connect(); return client; }
  catch (error) { await client.close(); throw error; }
}

let client;
try {
  try { client = await connect(); } catch {
    await mkdir(directory, { recursive: true });
    const child = spawn(await executable(), [
      '--replSet', 'rs0', '--port', '27018', '--bind_ip', '127.0.0.1',
      '--dbpath', directory, '--logpath', join(directory, 'mongod.log'), '--logappend',
    ], { detached: true, windowsHide: true, stdio: 'ignore' });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
    const deadline = Date.now() + 20000;
    while (!client && Date.now() < deadline) {
      try { client = await connect(); } catch { await pause(); }
    }
    if (!client) throw new Error(`MongoDB did not start. Check ${join(directory, 'mongod.log')}`);
  }
  const admin = client.db('admin');
  try {
    const status = await admin.command({ replSetGetStatus: 1 });
    if (status.set !== 'rs0') throw new Error('Port 27018 belongs to a different replica set.');
  } catch (error) {
    if (error.code !== 94) throw error;
    await admin.command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27018' }] } });
  }
  const deadline = Date.now() + 20000;
  while (!(await admin.command({ hello: 1 })).isWritablePrimary) {
    if (Date.now() >= deadline) throw new Error('Local replica set did not elect a primary.');
    await pause();
  }
  console.log('Local MongoDB replica set rs0 is ready.');
  console.log('MONGODB_URI=mongodb://127.0.0.1:27018/?replicaSet=rs0');
  console.log(`Data directory: ${directory}`);
  console.log('MongoDB stays running in the background; run this command again after restarting your computer.');
} catch (error) {
  console.error(`Local MongoDB failed: ${error.message}`);
  process.exitCode = 1;
} finally { if (client) await client.close(); }
