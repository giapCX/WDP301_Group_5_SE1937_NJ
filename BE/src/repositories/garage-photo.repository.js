import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { httpError } from '../utils/http-error.js';

export function createGaragePhotoRepository(directory) {
  const root = resolve(directory);
  function pathFor(key) {
    if (!/^garage-photos\/[a-f\d]{24}\/[a-f\d-]{36}\.(jpg|png|webp)$/i.test(key)) throw httpError(400, 'Khóa ảnh không hợp lệ.');
    const path = resolve(root, key.slice('garage-photos/'.length));
    if (!path.startsWith(root + sep)) throw httpError(400, 'Đường dẫn ảnh không hợp lệ.');
    return path;
  }
  return {
    async write(key, bytes) {
      const path = pathFor(key);
      await mkdir(resolve(path, '..'), { recursive: true });
      await writeFile(path, bytes, { flag: 'wx' });
    },
    async read(key) {
      try { return await readFile(pathFor(key)); }
      catch (error) {
        if (error.code === 'ENOENT') throw httpError(404, 'Ảnh chưa có tệp lưu trữ.');
        throw error;
      }
    },
  };
}
