import { describe, expect, it, vi } from 'vitest';
import { handlePlaceRequest } from '../../cloudfunctions/places/service';
import { scenicDetail, scenicPlace } from '../fixtures/places';

const storage = { getTempFileURL: vi.fn(async ({ fileList }: { fileList: string[] }) => ({ fileList: fileList.map(fileID => ({ fileID, tempFileURL: `https://temp.example/${fileID.slice(-4)}` })) })) };
const repository = { list: vi.fn(), detail: vi.fn() };

describe('placeService entry handler', () => {
  it('maps invalid list input to the public INVALID_INPUT envelope', async () => {
    const result = await handlePlaceRequest({ action: 'list', tags: 'not-an-array' }, { repository, storage });
    expect(result).toMatchObject({ code: 'INVALID_INPUT', data: null });
  });
  it('maps unavailable detail to NOT_FOUND without exposing database errors', async () => {
    repository.detail.mockResolvedValueOnce(null);
    const result = await handlePlaceRequest({ action: 'detail', placeId: scenicPlace.placeId }, { repository, storage });
    expect(result).toMatchObject({ code: 'NOT_FOUND', data: null });
  });
  it('returns only the resolved cover and section media for a valid detail', async () => {
    repository.detail.mockResolvedValueOnce({ ...scenicDetail, coverFileId: 'cloud://bucket/cover', sections: [{ type: 'image', fileId: 'cloud://bucket/section', alt: '合成图' }] });
    const result = await handlePlaceRequest({ action: 'detail', placeId: scenicPlace.placeId }, { repository, storage });
    expect(result).toMatchObject({ code: 'OK', data: { coverUrl: 'https://temp.example/over', sections: [{ url: 'https://temp.example/tion' }] } });
  });
});
