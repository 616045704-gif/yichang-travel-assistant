import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const categories = new Set(['scenic', 'restaurant', 'culture', 'camping']);
const dynamicFact = /(?:票价|营业时间|交通时刻|预约政策|需预约)/u;
const cloudFileId = /^cloud:\/\/[A-Za-z0-9._-]+\/.+/u;

function error(errors, placeId, field, message) {
  errors.push(`${placeId || '<unknown>'}.${field}: ${message}`);
}

export function validateContent(places, contents) {
  const errors = [];
  const ids = new Set();
  const contentIds = new Set();
  for (const place of places) {
    const id = place?.placeId;
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/u.test(id)) error(errors, id, 'placeId', 'must be a stable lowercase identifier');
    else if (ids.has(id)) error(errors, id, 'placeId', 'duplicate');
    else ids.add(id);
    for (const field of ['name', 'district', 'address', 'intro', 'openNotice', 'updatedAt']) if (typeof place?.[field] !== 'string' || !place[field].trim()) error(errors, id, field, 'must be non-empty text');
    if (!Array.isArray(place?.aliases) || place.aliases.some(alias => typeof alias !== 'string' || !alias.trim())) error(errors, id, 'aliases', 'must be an array of non-empty text');
    if (!Array.isArray(place?.tags) || place.tags.some(tag => typeof tag !== 'string' || !tag.trim())) error(errors, id, 'tags', 'must be an array of non-empty text');
    if (!categories.has(place?.category)) error(errors, id, 'category', 'must be one of the four supported categories');
    if (place?.coordinateSystem !== 'GCJ-02') error(errors, id, 'coordinateSystem', 'must be GCJ-02');
    if (!Number.isFinite(place?.latitude) || place.latitude < 3 || place.latitude > 54) error(errors, id, 'latitude', 'must be a valid China latitude');
    if (!Number.isFinite(place?.longitude) || place.longitude < 73 || place.longitude > 135) error(errors, id, 'longitude', 'must be a valid China longitude');
    if (!Array.isArray(place?.sources) || place.sources.length === 0 || place.sources.some(source => !source?.title || !/^https?:\/\//u.test(source.url) || !source.licenseNote)) error(errors, id, 'sources', 'each place needs a titled public URL and license note');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(place?.verifiedAt ?? '') || !Number.isFinite(Date.parse(place.verifiedAt))) error(errors, id, 'verifiedAt', 'must be an ISO UTC date');
    if (!['draft', 'published', 'archived'].includes(place?.status)) error(errors, id, 'status', 'must be draft, published, or archived');
    if (place?.coverFileId !== null && !cloudFileId.test(place?.coverFileId ?? '')) error(errors, id, 'coverFileId', 'must be null or a cloud:// file ID');
    if (place?.status === 'published' && (!cloudFileId.test(place?.coverFileId ?? '') || place.sources.some(source => !source.fieldEvidence || !source.fieldEvidence.name || !source.fieldEvidence.address || !source.fieldEvidence.coordinates))) error(errors, id, 'publicationEvidence', 'published places require an authorized cloud image and field-level official evidence');
    if (dynamicFact.test(JSON.stringify(place))) error(errors, id, 'content', 'contains an unverified dynamic fact label');
  }
  for (const content of contents) {
    const id = content?.placeId;
    if (!ids.has(id)) error(errors, id, 'placeId', 'has no matching place');
    if (contentIds.has(id)) error(errors, id, 'placeId', 'duplicate detail');
    contentIds.add(id);
    if (!Array.isArray(content?.sections) || content.sections.length === 0 || content.sections.some(section => section?.type === 'text' ? typeof section.text !== 'string' : section?.type === 'image' ? !cloudFileId.test(section.fileId ?? '') : true)) error(errors, id, 'sections', 'only non-empty text or cloud image sections are allowed');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(content?.updatedAt ?? '') || !Number.isFinite(Date.parse(content.updatedAt))) error(errors, id, 'updatedAt', 'must be an ISO UTC date');
    if (dynamicFact.test(JSON.stringify(content))) error(errors, id, 'content', 'contains an unverified dynamic fact label');
  }
  for (const id of ids) if (!contentIds.has(id)) error(errors, id, 'place_contents', 'missing detail');
  return errors;
}

export async function loadAndValidateContent(root = process.cwd()) {
  const readJson = name => readFile(path.join(root, 'content', name), 'utf8').then(JSON.parse);
  const [places, contents] = await Promise.all([readJson('places.seed.json'), readJson('place-contents.seed.json')]);
  const errors = validateContent(places, contents);
  if (errors.length) throw new Error(`Content validation failed:\n${errors.join('\n')}`);
  return { places, contents };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { places, contents } = await loadAndValidateContent();
  console.log(`Content valid: ${places.length} places, ${contents.length} details`);
}
