import { expect, it } from 'vitest';
import { buildUserProvidedImageBinding } from '../../scripts/build-user-provided-image-binding.mjs';

const categories = ['scenic', 'restaurant', 'culture', 'camping'];
const manifest = categories.map((category, index) => ({
  placeId: `place-${index}`, category, sourceType: 'user_provided',
  objectNames: [`cover-${index}.png`, `detail-${index}-2.png`, `detail-${index}-3.png`],
  rightsNote: '用户确认可用于本项目的学习与面试演示。', verifiedAt: '2026-09-06T00:00:00.000Z',
}));

const places = manifest.map((entry) => ({
  _id: entry.placeId, placeId: entry.placeId, name: `测试${entry.category}`, category: entry.category,
  status: 'published', coordinateSystem: 'GCJ-02', coverFileId: null,
}));

const contents = manifest.map((entry) => ({ _id: entry.placeId, sections: [{ type: 'text', text: '原始详情' }] }));

it('binds one cover and two distinct detail images without replacing text', () => {
  const result = buildUserProvidedImageBinding({
    manifest,
    places,
    contents,
    fileIdPrefix: 'cloud://test-bucket',
  });

  expect(result.places).toHaveLength(4);
  expect(result.places[0]).toEqual({ ...places[0], coverFileId: 'cloud://test-bucket/cover-0.png' });
  expect(result.contents[0].sections).toEqual([
    { type: 'text', text: '原始详情' },
    { type: 'image', fileId: 'cloud://test-bucket/detail-0-2.png', alt: '测试scenic图片 2' },
    { type: 'image', fileId: 'cloud://test-bucket/detail-0-3.png', alt: '测试scenic图片 3' },
  ]);
});

it('removes only the two previous target detail images before rebinding', () => {
  const result = buildUserProvidedImageBinding({
    manifest,
    places,
    contents: [{ _id: 'place-0', sections: [
      { type: 'text', text: '原始详情' },
      { type: 'image', fileId: 'cloud://test-bucket/detail-0-2.png', alt: '旧图片 2' },
      { type: 'image', fileId: 'cloud://test-bucket/other.png', alt: '保留图片' },
      { type: 'image', fileId: 'cloud://test-bucket/detail-0-3.png', alt: '旧图片 3' },
    ] }, ...contents.slice(1)],
    fileIdPrefix: 'cloud://test-bucket',
  });

  expect(result.contents[0].sections).toEqual([
    { type: 'text', text: '原始详情' },
    { type: 'image', fileId: 'cloud://test-bucket/other.png', alt: '保留图片' },
    { type: 'image', fileId: 'cloud://test-bucket/detail-0-2.png', alt: '测试scenic图片 2' },
    { type: 'image', fileId: 'cloud://test-bucket/detail-0-3.png', alt: '测试scenic图片 3' },
  ]);
});

it('refuses a non-published or mismatched target place before producing output', () => {
  expect(() => buildUserProvidedImageBinding({
    manifest,
    places: [{ ...places[0], status: 'draft' }, ...places.slice(1)],
    contents,
    fileIdPrefix: 'cloud://test-bucket',
  })).toThrow('place-0 does not satisfy place preconditions');
});
