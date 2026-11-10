import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';
import { createCloudinaryGaragePhotoRepository } from '../src/repositories/cloudinary-garage-photo.repository.js';

const key = 'garage-photos/02000000000000000000000f/12345678-1234-1234-1234-123456789012.png';
const credentials = { cloud_name: 'test', api_key: 'key', api_secret: 'secret' };

test('uploads authenticated images with stable keys and streams the original bytes', async () => {
  let options, uploaded;
  const client = { uploader: { upload_stream(settings, callback) {
    options = settings;
    return new Writable({ write(chunk, encoding, done) { uploaded = chunk; done(); }, final(done) { callback(null, {}); done(); } });
  } } };
  const repository = createCloudinaryGaragePhotoRepository(credentials, { client });
  const bytes = Buffer.from('test image');
  await repository.write(key, bytes);
  assert.deepEqual(uploaded, bytes);
  assert.equal(options.type, 'authenticated');
  assert.equal(options.public_id, key.replace(/\.png$/, ''));
  assert.equal(options.format, 'png');
  assert.equal(options.overwrite, false);
});

test('reads via expiring authenticated downloads and returns bytes, not a public URL', async () => {
  const bytes = Buffer.from('test image');
  const client = { utils: { private_download_url(id, format, options) {
    assert.equal(id, key.replace(/\.png$/, ''));
    assert.equal(format, 'png');
    assert.equal(options.type, 'authenticated');
    assert.ok(options.expires_at > Date.now() / 1000);
    assert.ok(options.expires_at <= Date.now() / 1000 + 60);
    return 'https://example.test/signed';
  } } };
  const repository = createCloudinaryGaragePhotoRepository(credentials, { client, fetchImage: async (url, options) => {
    assert.equal(url, 'https://example.test/signed');
    assert.ok(options.signal);
    return new Response(bytes);
  } });
  assert.deepEqual(await repository.read(key), bytes);
});

test('rejects invalid keys before contacting cloud storage', async () => {
  const repository = createCloudinaryGaragePhotoRepository(credentials, { client: {} });
  await assert.rejects(repository.read('../secret'), { status: 400 });
  await assert.rejects(repository.write('../secret', Buffer.alloc(1)), { status: 400 });
});

test('maps upstream failures without exposing credentials or signed URLs', async () => {
  const client = {
    uploader: { upload_stream() { throw new Error('sensitive upstream details'); } },
    utils: { private_download_url() { return 'https://example.test/signed'; } },
  };
  const repository = createCloudinaryGaragePhotoRepository(credentials, { client, fetchImage: async () => new Response('', { status: 401 }) });
  await assert.rejects(repository.write(key, Buffer.alloc(1)), { status: 503, message: 'Không thể tải ảnh lên Cloudinary. Vui lòng thử lại.' });
  await assert.rejects(repository.read(key), { status: 503, message: 'Không thể đọc ảnh từ Cloudinary. Vui lòng thử lại.' });
  const missing = createCloudinaryGaragePhotoRepository(credentials, { client, fetchImage: async () => new Response('', { status: 404 }) });
  await assert.rejects(missing.read(key), { status: 404 });
});
