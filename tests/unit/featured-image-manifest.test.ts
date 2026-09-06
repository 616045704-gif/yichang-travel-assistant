import { expect, it } from 'vitest';
import { validateFeaturedImages } from '../../scripts/validate-featured-images.mjs';

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
