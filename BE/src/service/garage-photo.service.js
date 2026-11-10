import { randomUUID } from 'node:crypto';
import { httpError } from '../utils/http-error.js';

export function createGaragePhotoService(repository) {
  function identify(bytes) {
    if (bytes.length > 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: 'jpg', contentType: 'image/jpeg' };
    if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: 'png', contentType: 'image/png' };
    if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', contentType: 'image/webp' };
    throw httpError(400, 'Nội dung tệp phải là ảnh JPG, PNG hoặc WebP.');
  }
  return {
    async upload(body, actor) {
      if (!body || Object.keys(body).some((key) => !['name', 'contentType', 'data'].includes(key)) || typeof body.data !== 'string' || !/^[a-z\d+/]+={0,2}$/i.test(body.data) || body.data.length > 683000) throw httpError(400, 'Ảnh tải lên không hợp lệ hoặc vượt quá 500 KB.');
      const bytes = Buffer.from(body.data, 'base64');
      if (!bytes.length || bytes.length > 500 * 1024 || bytes.toString('base64') !== body.data) throw httpError(400, 'Dữ liệu ảnh không hợp lệ.');
      const type = identify(bytes);
      if (body.contentType !== type.contentType) throw httpError(400, 'Định dạng ảnh không khớp với nội dung.');
      const key = `garage-photos/${actor._id}/${randomUUID()}.${type.extension}`;
      await repository.write(key, bytes);
      return { key, name: typeof body.name === 'string' ? body.name.slice(0, 100) : 'Ảnh hiện trạng' };
    },
    async get(key) {
      const bytes = await repository.read(key);
      return { bytes, contentType: identify(bytes).contentType };
    },
  };
}
