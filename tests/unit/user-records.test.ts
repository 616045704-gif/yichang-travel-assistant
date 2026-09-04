import { describe, expect, it, vi } from 'vitest';
import { handleUserRequest } from '../../cloudfunctions/users/service';
import type { UserRepository } from '../../cloudfunctions/users/repository';

function repository(): UserRepository {
  return {
    isPublishedPlace: vi.fn().mockResolvedValue(true), setFavorite: vi.fn().mockResolvedValue(undefined), recordBrowse: vi.fn().mockResolvedValue('2026-09-04T00:00:00.000Z'),
    listRecords: vi.fn().mockResolvedValue({ items: [], nextCursor: null }), favoritePlaceIds: vi.fn().mockResolvedValue(new Set()), getPreferences: vi.fn().mockResolvedValue(['美食探索']), savePreferences: vi.fn().mockImplementation(async (_owner, preferences) => preferences),
  };
}

describe('private user record service', () => {
  it('uses only the trusted owner for favorite, browse and record queries', async () => {
    const records = repository();
    await handleUserRequest({ action: 'setFavorite', placeId: 'place-1', favorite: true, ownerId: 'forged-user' }, { ownerId: 'trusted-user', repository: records });
    await handleUserRequest({ action: 'recordBrowse', placeId: 'place-1', openid: 'forged-user' }, { ownerId: 'trusted-user', repository: records });
    await handleUserRequest({ action: 'listRecords', type: 'favorites', cursor: null }, { ownerId: 'trusted-user', repository: records });
    expect(records.setFavorite).toHaveBeenCalledWith('trusted-user', 'place-1', true);
    expect(records.recordBrowse).toHaveBeenCalledWith('trusted-user', 'place-1');
    expect(records.listRecords).toHaveBeenCalledWith('trusted-user', 'favorites', null, 20);
  });
  it('is idempotent for same-state favorites and permits canceling an absent favorite', async () => {
    const records = repository();
    await handleUserRequest({ action: 'setFavorite', placeId: 'place-1', favorite: false }, { ownerId: 'trusted-user', repository: records });
    await handleUserRequest({ action: 'setFavorite', placeId: 'place-1', favorite: false }, { ownerId: 'trusted-user', repository: records });
    expect(records.setFavorite).toHaveBeenNthCalledWith(1, 'trusted-user', 'place-1', false);
    expect(records.setFavorite).toHaveBeenNthCalledWith(2, 'trusted-user', 'place-1', false);
  });
  it('rejects unauthenticated, unavailable and invalid requests without exposing records', async () => {
    const records = repository();
    expect((await handleUserRequest({ action: 'listRecords', type: 'favorites' }, { ownerId: null, repository: records })).code).toBe('UNAUTHENTICATED');
    vi.mocked(records.isPublishedPlace).mockResolvedValue(false);
    expect((await handleUserRequest({ action: 'recordBrowse', placeId: 'place-1' }, { ownerId: 'trusted-user', repository: records })).code).toBe('NOT_FOUND');
    expect((await handleUserRequest({ action: 'savePreferences', preferences: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, { ownerId: 'trusted-user', repository: records })).code).toBe('INVALID_INPUT');
    expect(records.recordBrowse).not.toHaveBeenCalled();
  });
  it('keeps the current owner boundary when saving preferences', async () => {
    const records = repository();
    const result = await handleUserRequest({ action: 'savePreferences', preferences: ['自然风景', '自然风景', '人文历史'], ownerId: 'forged-user' }, { ownerId: 'trusted-user', repository: records });
    expect(result).toMatchObject({ code: 'OK', data: { preferences: ['自然风景', '人文历史'] } });
    expect(records.savePreferences).toHaveBeenCalledWith('trusted-user', ['自然风景', '人文历史']);
  });
  it('keeps the planned trip-record contract private and empty until AI history exists', async () => {
    const records = repository();
    await expect(handleUserRequest({ action: 'listRecords', type: 'trips', ownerId: 'forged-user' }, { ownerId: 'trusted-user', repository: records })).resolves.toMatchObject({ code: 'OK', data: { items: [], nextCursor: null } });
    expect(records.listRecords).not.toHaveBeenCalled();
  });
});
