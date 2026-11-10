import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readdir, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import net from 'node:net';
import { MongoClient } from 'mongodb';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function binaryPath() {
  if (process.env.MONGOD_BINARY) return process.env.MONGOD_BINARY;
  if (process.platform !== 'win32') return 'mongod';
  const root = join(
    process.env.ProgramFiles || 'C:\\Program Files',
    'MongoDB',
    'Server',
  );
  for (const version of (await readdir(root)).sort().reverse()) {
    const binary = join(root, version, 'bin', 'mongod.exe');
    try {
      await access(binary);
      return binary;
    } catch {
      /* Try another installed version. */
    }
  }
  throw new Error(
    'Set MONGOD_BINARY to the installed mongod executable to run intake transaction tests.',
  );
}

export async function startIntakeTestReplica() {
  if (process.env.INTAKE_TEST_MONGODB_URI) {
    const client = await new MongoClient(process.env.INTAKE_TEST_MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    }).connect();
    const hello = await client.db('admin').command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      await client.close();
      throw new Error('INTAKE_TEST_MONGODB_URI must point to a replica set.');
    }
    return { client, close: () => client.close() };
  }
  const binary = await binaryPath();
  const portServer = net.createServer();
  portServer.listen(0, '127.0.0.1');
  await once(portServer, 'listening');
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  const directory = await mkdtemp(join(tmpdir(), 'xedi-intake-test-'));
  const child = spawn(
    binary,
    [
      '--dbpath',
      directory,
      '--port',
      String(port),
      '--bind_ip',
      '127.0.0.1',
      '--replSet',
      'xediIntakeTest',
      '--logpath',
      join(directory, 'mongod.log'),
      '--wiredTigerCacheSizeGB',
      '0.25',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let spawnError;
  child.on('error', (error) => {
    spawnError = error;
  });
  let client;
  async function close() {
    if (client) await client.close();
    if (child.pid && child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    // Only remove the temporary directory created above, never a configured DB path.
    const target = resolve(directory);
    if (
      !target.startsWith(resolve(tmpdir()) + sep) ||
      !basename(target).startsWith('xedi-intake-test-')
    )
      throw new Error('Refusing cleanup outside the intake test directory.');
    await rm(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
  try {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null)
        throw new Error('Temporary mongod exited before becoming ready.');
      try {
        client = await new MongoClient(
          `mongodb://127.0.0.1:${port}/?directConnection=true`,
          { serverSelectionTimeoutMS: 300 },
        ).connect();
        break;
      } catch {
        if (client) await client.close();
        client = undefined;
        await pause(100);
      }
    }
    if (!client) throw new Error('Temporary MongoDB startup timed out.');
    await client
      .db('admin')
      .command({
        replSetInitiate: {
          _id: 'xediIntakeTest',
          members: [{ _id: 0, host: `127.0.0.1:${port}` }],
        },
      });
    while (Date.now() < deadline) {
      if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary)
        return { client, close };
      await pause(100);
    }
    throw new Error('Replica set primary election timed out.');
  } catch (error) {
    await close();
    throw error;
  }
}
