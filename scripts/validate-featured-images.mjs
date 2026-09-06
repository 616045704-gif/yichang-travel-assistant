const CATEGORIES = new Set(['scenic', 'restaurant', 'culture', 'camping']);
const COMMONS_FILE = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/u;
const CLOUD_FILE = /^cloud:\/\/[A-Za-z0-9._-]+\/.+/u;
const COMMONS_LICENSE = /^(?:CC0(?:\s+1\.0)?|CC BY(?:-SA)?\s+\d\.\d|Public domain)$/iu;
const SAFE_OBJECT_NAME = /^[^\\/]+\.(?:jpe?g|png|webp)$/iu;

function isUtcDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function validateFeaturedImages(records) {
  const errors = [];
  if (!Array.isArray(records)) return ['records must be an array'];
  const ids = new Set();
  const categories = new Set();
  for (const [index, item] of records.entries()) {
    const prefix = typeof item?.placeId === 'string' && item.placeId ? item.placeId : `record[${index}]`;
    if (!item?.placeId) errors.push(`${prefix}.placeId required`);
    else if (ids.has(item.placeId)) errors.push(`${prefix}.placeId duplicate`);
    else ids.add(item.placeId);
    if (!CATEGORIES.has(item?.category)) errors.push(`${item?.placeId}.category`);
    else categories.add(item.category);
    if (item?.sourceType === 'user_provided') {
      if (!Array.isArray(item.objectNames) || item.objectNames.length !== 3 || item.objectNames.some((name) => !SAFE_OBJECT_NAME.test(name))) {
        errors.push(`${prefix}.objectNames`);
      }
      if (typeof item?.rightsNote !== 'string' || !item.rightsNote.trim()) errors.push(`${prefix}.rightsNote`);
    } else {
      for (const key of ['author', 'license', 'attribution']) {
        if (typeof item?.[key] !== 'string' || !item[key].trim()) errors.push(`${item?.placeId}.${key}`);
      }
      if (!COMMONS_LICENSE.test(item?.license ?? '')) errors.push(`${prefix}.license`);
      if (!COMMONS_FILE.test(item?.commonsFilePage ?? '')) errors.push(`${item?.placeId}.commonsFilePage`);
      if (!CLOUD_FILE.test(item?.cloudFileId ?? '')) errors.push(`${item?.placeId}.cloudFileId`);
    }
    if (!isUtcDate(item?.verifiedAt)) errors.push(`${prefix}.verifiedAt`);
  }
  for (const category of CATEGORIES) if (!categories.has(category)) errors.push(`categories.${category} required`);
  return errors;
}
