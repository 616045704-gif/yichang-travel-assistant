import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { validateFeaturedImages } from '../../scripts/validate-featured-images.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

type UserProvidedImageEntry = {
  category: string;
  objectNames: string[];
  sourceType: string;
};

it('requires a Commons file page, attribution, license, cloud file ID and four categories', () => {
  const errors = validateFeaturedImages([{ placeId: 'place-a', category: 'scenic' }]);

  expect(errors.join('\n')).toMatch(/commonsFilePage|author|license|attribution|cloudFileId|verifiedAt/);
});

it('accepts a complete entry in each supported category', () => {
  const errors = validateFeaturedImages(['scenic', 'restaurant', 'culture', 'camping'].map((category, index) => ({
    placeId: `place-${index}`,
    category,
    commonsFilePage: `https://commons.wikimedia.org/wiki/File:Place_${index}.jpg`,
    author: 'Example Author',
    license: 'CC BY 4.0',
    attribution: 'Example Author, CC BY 4.0, via Wikimedia Commons',
    cloudFileId: `cloud://example-bucket/covers/place-${index}.jpg`,
    verifiedAt: '2026-09-06T00:00:00.000Z',
  })));

  expect(errors).toEqual([]);
});

it('accepts a user-provided, authorised three-image entry without recording a cloud identifier', () => {
  const errors = validateFeaturedImages(['scenic', 'restaurant', 'culture', 'camping'].map((category, index) => ({
    placeId: `place-user-${index}`,
    category,
    sourceType: 'user_provided',
    objectNames: [`place-${index}.jpg`, `place-${index}-2.jpg`, `place-${index}-3.jpg`],
    rightsNote: '用户确认可用于本项目的学习与面试演示。',
    verifiedAt: '2026-09-06T00:00:00.000Z',
  })));

  expect(errors).toEqual([]);
});

it('requires every category and rejects unclear licenses and impossible verification dates', () => {
  const record = {
    placeId: 'place-a', category: 'scenic', commonsFilePage: 'https://commons.wikimedia.org/wiki/File:Place.jpg',
    author: 'Example Author', license: 'unknown', attribution: 'Example Author',
    cloudFileId: 'cloud://example-bucket/covers/place.jpg', verifiedAt: '2026-99-99T00:00:00.000Z',
  };

  const errors = validateFeaturedImages([record]);

  expect(errors).toContain('categories.restaurant required');
  expect(errors).toContain('place-a.license');
  expect(errors).toContain('place-a.verifiedAt');
});

it('keeps all 25 authorised user-provided image mappings complete and distinct', async () => {
  const manifest: UserProvidedImageEntry[] = JSON.parse(await readFile(
    path.join(repositoryRoot, 'content', 'featured-place-images.json'),
    'utf8',
  ));

  expect(manifest).toHaveLength(25);
  expect(validateFeaturedImages(manifest)).toEqual([]);
  expect(new Set(manifest.map((entry) => entry.category))).toEqual(
    new Set(['scenic', 'restaurant', 'culture', 'camping']),
  );
  for (const entry of manifest) {
    expect(entry.sourceType).toBe('user_provided');
    expect(entry.objectNames).toHaveLength(3);
    expect(new Set(entry.objectNames)).toHaveLength(3);
  }
});
