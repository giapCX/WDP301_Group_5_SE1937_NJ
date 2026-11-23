import { randomUUID } from 'node:crypto';
import { identifyImage } from '../utils/image-content.js';
import { httpError } from '../utils/http-error.js';

export function createGaragePhotoService(repository) {
  return {
    async upload(body, actor) {
      if (!body || Object.keys(body).some((key) => !['name', 'contentType', 'data'].includes(key)) || typeof body.data !== 'string' || !/^[a-z\d+/]+={0,2}$/i.test(body.data) || body.data.length > 683000) throw httpError(400, 'Ảnh tải lên không hợp lệ hoặc vượt quá 500 KB.');
      const bytes = Buffer.from(body.data, 'base64');
      if (!bytes.length || bytes.length > 500 * 1024 || bytes.toString('base64') !== body.data) throw httpError(400, 'Dữ liệu ảnh không hợp lệ.');
      const type = identifyImage(bytes);
      if (!type) throw httpError(400, 'Nội dung tệp phải là ảnh JPG, PNG hoặc WebP.');
      if (body.contentType !== type.contentType) throw httpError(400, 'Định dạng ảnh không khớp với nội dung.');
      const key = `garage-photos/${actor._id}/${randomUUID()}.${type.extension}`;
      await repository.write(key, bytes);
      return { key, name: typeof body.name === 'string' ? body.name.slice(0, 100) : 'Ảnh hiện trạng' };
    },
    async get(key) {
      const bytes = await repository.read(key);
      const type = identifyImage(bytes);
      if (!type) throw httpError(400, 'Nội dung tệp phải là ảnh JPG, PNG hoặc WebP.');
      return { bytes, contentType: type.contentType };
    },
  };
}
