import { v2 as cloudinary } from 'cloudinary';
import { httpError } from '../utils/http-error.js';

export function createCloudinaryGaragePhotoRepository(credentials, { client = cloudinary, fetchImage = fetch } = {}) {
  function assetFor(key) {
    if (!/^garage-photos\/[a-f\d]{24}\/[a-f\d-]{36}\.(jpg|png|webp)$/i.test(key)) {
      throw httpError(400, 'Khóa ảnh không hợp lệ.');
    }
    const dot = key.lastIndexOf('.');
    return { publicId: key.slice(0, dot), format: key.slice(dot + 1) };
  }

  return {
    async write(key, bytes) {
      const { publicId, format } = assetFor(key);
      try {
        await new Promise((resolve, reject) => {
          const stream = client.uploader.upload_stream({
            ...credentials,
            resource_type: 'image',
            type: 'authenticated',
            public_id: publicId,
            format,
            overwrite: false,
            timeout: 30000,
          }, (error, result) => error ? reject(error) : resolve(result));
          stream.on('error', reject);
          stream.end(bytes);
        });
      } catch {
        throw httpError(503, 'Không thể tải ảnh lên Cloudinary. Vui lòng thử lại.');
      }
    },
    async read(key) {
      const { publicId, format } = assetFor(key);
      try {
        // Keep the signed URL on the server; the existing Garage API checks JWT permissions.
        const url = client.utils.private_download_url(publicId, format, {
          ...credentials,
          resource_type: 'image',
          type: 'authenticated',
          expires_at: Math.floor(Date.now() / 1000) + 60,
        });
        const response = await fetchImage(url, { signal: AbortSignal.timeout(30000) });
        if (response.status === 404) throw httpError(404, 'Ảnh chưa có tệp lưu trữ.');
        if (!response.ok) throw new Error('Cloudinary download failed.');
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        if (error.status === 404) throw error;
        throw httpError(503, 'Không thể đọc ảnh từ Cloudinary. Vui lòng thử lại.');
      }
    },
  };
}
