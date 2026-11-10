import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';
import { createCloudinaryOwnerFileRepository } from '../src/repositories/cloudinary-owner-file.repository.js';

const credentials = { cloud_name: 'test', api_key: 'key', api_secret: 'secret' };
const ownerId = '02000000000000000000000f';

test('stores owner documents as authenticated Cloudinary assets with a stable private key', async () => {
  let options, uploaded;
  const client = { uploader: { upload_stream(settings, callback) {
    options = settings;
    return new Writable({ write(chunk, _encoding, done) { uploaded = chunk; done(); }, final(done) { callback(null, {}); done(); } });
  } } };
  const repository = createCloudinaryOwnerFileRepository(credentials, { client });
  const key = await repository.save(ownerId, { contentType: 'application/pdf', bytes: Buffer.from('document') }, 'vehicle_registration');

  assert.match(key, new RegExp(`^owner-files/${ownerId}/vehicle_registration/[a-f\\d-]{36}\\.pdf$`));
  assert.deepEqual(uploaded, Buffer.from('document'));
  assert.equal(options.type, 'authenticated');
  assert.equal(options.resource_type, 'raw');
  assert.equal(options.format, 'pdf');
  assert.equal(options.overwrite, false);
});

test('uses image assets for vehicle photos and removes authenticated files during rollback', async () => {
  let destroyed;
  const client = { uploader: {
    upload_stream(_settings, callback) {
      return new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) { callback(null, {}); done(); } });
    },
    async destroy(publicId, settings) { destroyed = { publicId, settings }; },
  } };
  const repository = createCloudinaryOwnerFileRepository(credentials, { client });
  const key = await repository.save(ownerId, { contentType: 'image/png', bytes: Buffer.from('image') }, 'vehicle_photo');
  await repository.remove([key]);

  assert.equal(destroyed.publicId, key.replace(/\.png$/, ''));
  assert.equal(destroyed.settings.type, 'authenticated');
  assert.equal(destroyed.settings.resource_type, 'image');
});

test('rejects an invalid owner upload before contacting Cloudinary', async () => {
  const repository = createCloudinaryOwnerFileRepository(credentials, { client: { uploader: {} } });
  await assert.rejects(
    repository.save(ownerId, { contentType: 'text/plain', bytes: Buffer.from('x') }, 'vehicle_photo'),
    { status: 400 },
  );
});
