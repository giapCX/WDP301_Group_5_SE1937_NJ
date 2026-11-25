const HttpError = require('./http-error');

const CHECKLIST_ITEMS = [
  'exterior', 'interior', 'tires', 'lights', 'brakes', 'fuel', 'documents', 'safety',
];
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const IMAGE_SIGNATURES = {
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

function readPhoto(photo) {
  const { content_type: contentType, base64 } = photo || {};
  const signature = Object.hasOwn(IMAGE_SIGNATURES, contentType)
    && IMAGE_SIGNATURES[contentType];
  if (!signature || typeof base64 !== 'string') {
    throw new HttpError(400, 'Ảnh kiểm tra phải ở định dạng JPG hoặc PNG');
  }
  if (base64.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4) {
    throw new HttpError(400, 'Mỗi ảnh kiểm tra tối đa 2 MB');
  }
  const data = Buffer.from(base64, 'base64');
  if (data.length > MAX_PHOTO_BYTES) {
    throw new HttpError(400, 'Mỗi ảnh kiểm tra tối đa 2 MB');
  }
  if (data.length <= signature.length || !data.subarray(0, signature.length).equals(signature)
    || data.toString('base64') !== base64) {
    throw new HttpError(400, 'Nội dung ảnh kiểm tra không hợp lệ');
  }
  return { content_type: contentType, data };
}

function readInspectionPhotos(photos) {
  if (!Array.isArray(photos) || photos.length < 1 || photos.length > MAX_PHOTOS) {
    throw new HttpError(400, 'Cần đính kèm từ 1 đến 3 ảnh');
  }
  return photos.map(readPhoto);
}

function readInspectionDetails(input) {
  const { checklist, fuel_percent: fuelPercent, photos, result } = input;
  if (!checklist || Object.keys(checklist).length !== CHECKLIST_ITEMS.length
    || CHECKLIST_ITEMS.some((item) => !['passed', 'failed'].includes(checklist[item]))) {
    throw new HttpError(400, 'Cần đánh giá đạt hoặc không đạt cho đủ 8 hạng mục');
  }
  const expectedResult = CHECKLIST_ITEMS.every((item) => checklist[item] === 'passed')
    ? 'passed' : 'failed';
  if (result !== expectedResult) {
    throw new HttpError(400, 'Kết quả kiểm tra phải khớp với checklist');
  }
  if (!Number.isInteger(fuelPercent) || fuelPercent < 0 || fuelPercent > 100) {
    throw new HttpError(400, 'Mức nhiên liệu phải là số nguyên từ 0 đến 100%');
  }
  const images = readInspectionPhotos(photos);
  return {
    checklist,
    fuel_percent: fuelPercent,
    photos: images,
    photo_count: images.length,
  };
}

module.exports = { CHECKLIST_ITEMS, readInspectionDetails, readInspectionPhotos };
