const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const port = Number(process.argv[2] || 27017);
const host = '127.0.0.1';
const replicaSet = 'rentalLocal';
const uri = `mongodb://${host}:${port}/admin?directConnection=true`;
async function connect() {
  return mongoose.createConnection(uri, { serverSelectionTimeoutMS: 1000 }).asPromise();
}
async function main() {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid MongoDB port');
  }
  const root = path.resolve(__dirname, '..');
  const directory = path.join(root, 'storage', port === 27017 ? 'mongodb-replica' : `mongodb-replica-${port}`);
  fs.mkdirSync(directory, { recursive: true });
  let connection;
  try {
    connection = await connect();
  } catch {
    const installation = path.join(
      process.env.ProgramFiles || 'C:/Program Files',
      'MongoDB',
      'Server',
    );
    const versions = fs
      .readdirSync(installation)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    const executable = versions
      .map((version) => path.join(installation, version, 'bin', 'mongod.exe'))
      .find(fs.existsSync);
    if (!executable) throw new Error('Cannot find mongod.exe');
    const child = spawn(
      executable,
      [
        '--dbpath',
        directory,
        '--port',
        String(port),
        '--bind_ip',
        host,
        '--replSet',
        replicaSet,
        '--logpath',
        path.join(directory, 'mongod.log'),
        '--logappend',
      ],
      { detached: true, windowsHide: true, stdio: 'ignore' },
    );
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    child.unref();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        connection = await connect();
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }
  if (!connection)
    throw new Error(
          `Replica process did not start; check ${path.join(directory, 'mongod.log')}`,
    );
  try {
    const hello = await connection.db.admin().command({ hello: 1 });
    if (!hello.setName) {
      try {
        await connection.db.admin().command({
          replSetInitiate: {
            _id: replicaSet,
            members: [{ _id: 0, host: `${host}:${port}` }],
          },
        });
      } catch (error) {
        if (error.codeName === 'NoReplicationEnabled') {
          throw new Error(`Port ${port} is occupied by a standalone MongoDB. Choose a free port for npm run db:local.`);
        }
        if (error.codeName !== 'AlreadyInitialized') throw error;
      }
    } else if (hello.setName !== replicaSet) {
      throw new Error(`Port ${port} belongs to another replica set`);
    }
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const state = await connection.db.admin().command({ hello: 1 });
      if (state.isWritablePrimary && state.setName === replicaSet) {
        console.log(
          `Replica ready: mongodb://${host}:${port}/tourist_car_rental_demo?replicaSet=${replicaSet}`,
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error('Replica set did not elect a primary');
  } finally {
    await connection.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
