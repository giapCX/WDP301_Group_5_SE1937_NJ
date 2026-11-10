import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { httpError } from '../utils/http-error.js';

const extensions = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const purposes = new Set(['vehicle_registration', 'inspection_certificate', 'insurance', 'vehicle_photo', 'incident_evidence', 'identity_document', 'driver_license']);

function assetFor(key) {
  const match = /^owner-files\/([a-f\d]{24})\/([a-z_]+)\/([a-f\d-]{36})\.(jpg|png|webp|pdf)$/i.exec(key);
  if (!match || !purposes.has(match[2])) throw httpError(400, 'Khóa tệp chủ xe không hợp lệ.');
  return {
    publicId: key.slice(0, key.lastIndexOf('.')),
    format: match[4].toLowerCase(),
    resourceType: match[4].toLowerCase() === 'pdf' ? 'raw' : 'image',
  };
}

export function createCloudinaryOwnerFileRepository(credentials, { client = cloudinary, fetchFile = fetch } = {}) {
  return {
    async save(ownerId, input, purpose) {
      const extension = extensions[input.contentType];
      if (!extension || !purposes.has(purpose)) throw httpError(400, 'Tệp chủ xe không hợp lệ.');
      const key = `owner-files/${ownerId}/${purpose}/${randomUUID()}.${extension}`;
      const { publicId, format, resourceType } = assetFor(key);
      try {
        await new Promise((resolve, reject) => {
          const stream = client.uploader.upload_stream({
            ...credentials,
            resource_type: resourceType,
            type: 'authenticated',
            public_id: publicId,
            format,
            overwrite: false,
            timeout: 30000,
          }, (error, result) => error ? reject(error) : resolve(result));
          stream.on('error', reject);
          stream.end(input.bytes);
        });
        return key;
      } catch {
        throw httpError(503, 'Không thể tải tệp lên Cloudinary. Vui lòng thử lại.');
      }
    },
    async remove(keys) {
      await Promise.allSettled(keys.map(async (key) => {
        const { publicId, resourceType } = assetFor(String(key));
        await client.uploader.destroy(publicId, {
          ...credentials,
          resource_type: resourceType,
          type: 'authenticated',
          invalidate: true,
        });
      }));
    },
    async read(key) {
      const { publicId, format, resourceType } = assetFor(key);
      try {
        const url = client.utils.private_download_url(publicId, format, {
          ...credentials,
          resource_type: resourceType,
          type: 'authenticated',
          expires_at: Math.floor(Date.now() / 1000) + 60,
        });
        const response = await fetchFile(url, { signal: AbortSignal.timeout(30000) });
        if (response.status === 404) throw httpError(404, 'Tệp chưa có trong kho lưu trữ.');
        if (!response.ok) throw new Error('Cloudinary download failed.');
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        if (error.status === 404) throw error;
        throw httpError(503, 'Không thể đọc tệp từ Cloudinary. Vui lòng thử lại.');
      }
    },
  };
}
