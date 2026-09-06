import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFeaturedImages } from './validate-featured-images.mjs';

const categories = new Set(['scenic', 'restaurant', 'culture', 'camping']);
const CLOUD_PREFIX = /^cloud:\/\/[A-Za-z0-9._-]+$/u;

function fileId(prefix, objectName) {
  return `${prefix}/${objectName}`;
}

export function buildUserProvidedImageBinding({ manifest, places, contents, fileIdPrefix }) {
  if (!CLOUD_PREFIX.test(fileIdPrefix)) throw new Error('fileIdPrefix must be a cloud:// bucket prefix');
  const manifestErrors = validateFeaturedImages(manifest);
  if (manifestErrors.length) throw new Error(`Invalid image manifest: ${manifestErrors.join(', ')}`);

  const placeById = new Map(places.map((place) => [place._id, place]));
  const contentById = new Map(contents.map((content) => [content._id, content]));
  const boundPlaces = [];
  const boundContents = [];

  for (const entry of manifest) {
    if (entry.sourceType !== 'user_provided') throw new Error(`${entry.placeId} is not user-provided`);
    const place = placeById.get(entry.placeId);
    const content = contentById.get(entry.placeId);
    if (!place || !content) throw new Error(`${entry.placeId} has no paired import document`);
    if (place.placeId !== entry.placeId || place.status !== 'published' || place.category !== entry.category || !categories.has(place.category) || place.coordinateSystem !== 'GCJ-02') {
      throw new Error(`${entry.placeId} does not satisfy place preconditions`);
    }
    if (!Array.isArray(content.sections)) throw new Error(`${entry.placeId} has invalid sections`);

    const [coverName, detailOneName, detailTwoName] = entry.objectNames;
    const coverFileId = fileId(fileIdPrefix, coverName);
    const detailFileIds = [fileId(fileIdPrefix, detailOneName), fileId(fileIdPrefix, detailTwoName)];
    const sections = content.sections.filter((section) => !(
      section?.type === 'image' && detailFileIds.includes(section.fileId)
    ));

    boundPlaces.push({ ...place, coverFileId });
    boundContents.push({
      ...content,
      sections: [
        ...sections,
        { type: 'image', fileId: detailFileIds[0], alt: `${place.name}图片 2` },
        { type: 'image', fileId: detailFileIds[1], alt: `${place.name}图片 3` },
      ],
    });
  }

  return { places: boundPlaces, contents: boundContents };
}

async function readJsonLines(filePath) {
  const text = await readFile(filePath, 'utf8');
  return text.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const importDirectory = path.join(root, '.local', 'import');
  const outputDirectory = path.join(root, '.local', 'image-binding');
  const fileIdPrefix = process.env.CLOUDBASE_FILE_ID_PREFIX;
  if (!fileIdPrefix) throw new Error('CLOUDBASE_FILE_ID_PREFIX is required');
  const [manifest, places, contents] = await Promise.all([
    readFile(path.join(root, 'content', 'featured-place-images.json'), 'utf8').then(JSON.parse),
    readJsonLines(path.join(importDirectory, 'places.jsonl')),
    readJsonLines(path.join(importDirectory, 'place_contents.jsonl')),
  ]);
  const batch = buildUserProvidedImageBinding({ manifest, places, contents, fileIdPrefix });
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'places.jsonl'), `${batch.places.map(JSON.stringify).join('\n')}\n`),
    writeFile(path.join(outputDirectory, 'place_contents.jsonl'), `${batch.contents.map(JSON.stringify).join('\n')}\n`),
  ]);
  console.log(`Prepared ${batch.places.length} places and ${batch.contents.length} details.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
