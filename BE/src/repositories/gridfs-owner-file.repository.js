import mongoose from 'mongoose';

export function createGridFsOwnerFileRepository(connection) {
  const bucket = new mongoose.mongo.GridFSBucket(connection.db, { bucketName: 'owner_documents' });
  return {
    save(ownerId, input, purpose) {
      return new Promise((resolve, reject) => {
        const id = new mongoose.Types.ObjectId();
        const upload = bucket.openUploadStreamWithId(id, input.name.slice(0, 120), {
          contentType: input.contentType,
          metadata: { owner_id: ownerId, purpose },
        });
        upload.once('error', reject);
        upload.once('finish', () => resolve(id.toString()));
        upload.end(input.bytes);
      });
    },
    remove: (keys) => Promise.allSettled(keys.map((key) => bucket.delete(new mongoose.Types.ObjectId(String(key))))),
    read(key) {
      return new Promise((resolve, reject) => {
        const stream = bucket.openDownloadStream(new mongoose.Types.ObjectId(String(key)));
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.once('error', reject);
        stream.once('end', () => resolve(Buffer.concat(chunks)));
      });
    },
  };
}
