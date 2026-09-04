import { describe, expect, it } from 'vitest';
import { resolveSectionImageUrls } from '../../cloudfunctions/places/storage';

describe('place storage URL resolution', () => {
  it('only attaches a temporary URL to approved image sections', async () => {
    const result = await resolveSectionImageUrls([
      { type: 'text', text: '简介' },
      { type: 'image', fileId: 'cloud://bucket/image', alt: '示意图' },
    ], { async getTempFileURL() { return { fileList: [{ fileID: 'cloud://bucket/image', tempFileURL: 'https://temp.example/image' }] }; } });
    expect(result).toEqual([{ type: 'text', text: '简介' }, { type: 'image', fileId: 'cloud://bucket/image', alt: '示意图', url: 'https://temp.example/image' }]);
  });
});
