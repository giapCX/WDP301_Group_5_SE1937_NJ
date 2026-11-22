const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const uri = 'mongodb://127.0.0.1:27017/admin?directConnection=true';
async function connect() {
  return mongoose.createConnection(uri, { serverSelectionTimeoutMS: 1000 }).asPromise();
}
async function main() {
  const root = path.resolve(__dirname, '..');
  const directory = path.join(root, 'storage', 'mongodb-replica');
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
        '27017',
        '--bind_ip',
        '127.0.0.1',
        '--replSet',
        'rentalLocal',
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
      'Replica process did not start; check BE/storage/mongodb-replica/mongod.log',
    );
  try {
    const hello = await connection.db.admin().command({ hello: 1 });
    if (!hello.setName) {
      try {
        await connection.db.admin().command({
          replSetInitiate: {
            _id: 'rentalLocal',
            members: [{ _id: 0, host: '127.0.0.1:27017' }],
          },
        });
      } catch (error) {
        if (error.codeName === 'NoReplicationEnabled') {
          throw new Error(
            'MongoDB on 27017 is standalone. Run scripts/configure-local-mongodb.ps1 once in Administrator PowerShell, then retry npm run db:local.',
          );
        }
        if (error.codeName !== 'AlreadyInitialized') throw error;
      }
    } else if (hello.setName !== 'rentalLocal') {
      throw new Error('Port 27017 belongs to another replica set');
    }
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const state = await connection.db.admin().command({ hello: 1 });
      if (state.isWritablePrimary && state.setName === 'rentalLocal') {
        console.log(
          'Replica ready: mongodb://127.0.0.1:27017/tourist_car_rental_demo?replicaSet=rentalLocal',
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
